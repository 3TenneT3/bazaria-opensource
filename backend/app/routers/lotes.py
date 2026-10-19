from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import usuaria_actual
from app.core.errors import id_en_uso, not_found, IdRuta
from app.domain.costos import PrendaCosto, prorratear_lote
from app.models.models import Lote, Prenda, Usuaria
from app.schemas import LoteActualizar, LoteCrear, LoteOut
from app.serializers import lote_to_out

router = APIRouter(prefix="/lotes", tags=["lotes"])


async def exigir_lote_propio(db: AsyncSession, lote_id: str, usuaria_id: str) -> Lote:
    """Devuelve el lote si es de la usuaria; 404 si no existe o es de otra."""
    result = await db.execute(select(Lote).where(Lote.id == lote_id, Lote.usuaria_id == usuaria_id))
    lote = result.scalar_one_or_none()
    if lote is None:
        raise not_found("Lote no encontrado")
    return lote


async def recalcular_prorrateo(db: AsyncSession, lote: Lote) -> None:
    """Recalcula el prorrateo de las prendas vigentes del lote (status != descartada).

    El remanente de centavos va a la última prenda por orden de creación, igual que
    web/src/domain/costos.ts: por eso el ORDER BY es parte de la regla, no un detalle.
    Debe llamarse dentro de la misma transacción que la operación que lo dispara.
    """
    result = await db.execute(
        select(Prenda)
        .where(
            Prenda.lote_id == lote.id,
            Prenda.usuaria_id == lote.usuaria_id,
            Prenda.status != "descartada",
        )
        .order_by(Prenda.creada_en, Prenda.id)
    )
    prendas = result.scalars().all()
    if not prendas:
        return

    prendas_costo = [PrendaCosto(id=p.id, costo=p.costo, costo_manual=p.costo_manual) for p in prendas]
    nuevos_costos = prorratear_lote(
        lote.costo_total, lote.piezas_compradas, lote.piezas_descartadas, prendas_costo
    )
    for p in prendas:
        if p.id in nuevos_costos:
            p.costo = nuevos_costos[p.id]


@router.get("", response_model=list[LoteOut])
async def listar_lotes(
    db: AsyncSession = Depends(get_db), usuaria: Usuaria = Depends(usuaria_actual)
):
    result = await db.execute(
        select(Lote).where(Lote.usuaria_id == usuaria.id).order_by(Lote.creado_en.desc())
    )
    return [lote_to_out(l) for l in result.scalars().all()]


@router.post("", response_model=LoteOut, status_code=201)
async def crear_lote(
    data: LoteCrear,
    db: AsyncSession = Depends(get_db),
    usuaria: Usuaria = Depends(usuaria_actual),
):
    if data.id:
        # Reintento tras perder la respuesta: devolver el lote que ya se creó, no duplicarlo.
        existente = (await db.execute(select(Lote).where(Lote.id == data.id))).scalar_one_or_none()
        if existente is not None:
            if existente.usuaria_id != usuaria.id:
                raise id_en_uso()
            return lote_to_out(existente)

    lote = Lote(
        **({"id": data.id} if data.id else {}),
        usuaria_id=usuaria.id,
        nombre=data.nombre,
        costo_total=data.costo_total,
        piezas_compradas=data.piezas_compradas,
        piezas_descartadas=data.piezas_descartadas,
        fecha_compra=data.fecha_compra,
        notas=data.notas,
    )
    db.add(lote)
    await db.commit()
    await db.refresh(lote)
    return lote_to_out(lote)


@router.patch("/{lote_id}", response_model=LoteOut)
async def actualizar_lote(
    lote_id: IdRuta,
    data: LoteActualizar,
    db: AsyncSession = Depends(get_db),
    usuaria: Usuaria = Depends(usuaria_actual),
):
    result = await db.execute(
        select(Lote).where(Lote.id == lote_id, Lote.usuaria_id == usuaria.id)
    )
    lote = result.scalar_one_or_none()
    if lote is None:
        raise not_found("Lote no encontrado")

    campos = data.model_dump(exclude_unset=True)
    recalcular = any(
        campo in campos for campo in ("costo_total", "piezas_compradas", "piezas_descartadas")
    )
    for campo, valor in campos.items():
        setattr(lote, campo, valor)

    if recalcular:
        await recalcular_prorrateo(db, lote)

    await db.commit()
    await db.refresh(lote)
    return lote_to_out(lote)


@router.delete("/{lote_id}", status_code=204)
async def eliminar_lote(
    lote_id: IdRuta,
    db: AsyncSession = Depends(get_db),
    usuaria: Usuaria = Depends(usuaria_actual),
):
    result = await db.execute(
        select(Lote).where(Lote.id == lote_id, Lote.usuaria_id == usuaria.id)
    )
    lote = result.scalar_one_or_none()
    if lote is None:
        raise not_found("Lote no encontrado")

    # Las prendas del lote quedan con loteId: null (no se borran).
    prendas_result = await db.execute(
        select(Prenda).where(Prenda.lote_id == lote.id, Prenda.usuaria_id == usuaria.id)
    )
    for prenda in prendas_result.scalars().all():
        prenda.lote_id = None

    await db.delete(lote)
    await db.commit()
    return None
