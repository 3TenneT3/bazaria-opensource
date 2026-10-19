from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import usuaria_actual
from app.core.errors import ApiError, fecha_cliente_o_none, id_en_uso, not_found, IdRuta
from app.models.models import Prenda, Usuaria, Venta
from app.schemas import VentaCrear, VentaOut
from app.serializers import venta_to_out

router = APIRouter(tags=["ventas"])


@router.post("/prendas/{prenda_id}/venta", response_model=VentaOut, status_code=201)
async def registrar_venta(
    prenda_id: IdRuta,
    data: VentaCrear,
    db: AsyncSession = Depends(get_db),
    usuaria: Usuaria = Depends(usuaria_actual),
):
    if data.id:
        # Reintento tras perder la respuesta: devolver la venta que ya se registró, no duplicarla.
        previa = (await db.execute(select(Venta).where(Venta.id == data.id))).scalar_one_or_none()
        if previa is not None:
            if previa.usuaria_id != usuaria.id:
                raise id_en_uso()
            return venta_to_out(previa)

    result = await db.execute(
        select(Prenda).where(Prenda.id == prenda_id, Prenda.usuaria_id == usuaria.id)
    )
    prenda = result.scalar_one_or_none()
    if prenda is None:
        raise not_found("Prenda no encontrada")

    try:
        # UPDATE condicional: si dos peticiones llegan a la vez, solo una cambia la fila.
        # Un SELECT + chequeo en Python dejaría una ventana de carrera.
        marcada = await db.execute(
            update(Prenda)
            .where(Prenda.id == prenda.id, Prenda.usuaria_id == usuaria.id, Prenda.status != "vendida")
            .values(status="vendida")
        )
        if marcada.rowcount == 0:
            await db.rollback()
            raise ApiError(
                409, "YA_VENDIDA", "Esta prenda ya está vendida. Deshaz la venta para registrarla de nuevo."
            )
        venta = Venta(
            **({"id": data.id} if data.id else {}),
            usuaria_id=usuaria.id,
            prenda_id=prenda.id,
            precio_final=data.precio_final,
            costo_envio=data.costo_envio,
            comision=data.comision,
            canal=data.canal,
            fecha_venta=fecha_cliente_o_none(data.fecha_venta) or datetime.now(timezone.utc),
        )
        db.add(venta)
        await db.commit()
    except ApiError:
        raise
    except Exception:
        await db.rollback()
        raise

    await db.refresh(venta)
    return venta_to_out(venta)


@router.get("/ventas", response_model=list[VentaOut])
async def listar_ventas(
    desde: Optional[datetime] = None,
    hasta: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
    usuaria: Usuaria = Depends(usuaria_actual),
):
    query = select(Venta).where(Venta.usuaria_id == usuaria.id)
    if desde:
        query = query.where(Venta.fecha_venta >= desde)
    if hasta:
        query = query.where(Venta.fecha_venta <= hasta)
    query = query.order_by(Venta.fecha_venta.desc())
    result = await db.execute(query)
    return [venta_to_out(v) for v in result.scalars().all()]


@router.delete("/ventas/{venta_id}", status_code=204)
async def eliminar_venta(
    venta_id: IdRuta,
    db: AsyncSession = Depends(get_db),
    usuaria: Usuaria = Depends(usuaria_actual),
):
    result = await db.execute(
        select(Venta).where(Venta.id == venta_id, Venta.usuaria_id == usuaria.id)
    )
    venta = result.scalar_one_or_none()
    if venta is None:
        raise not_found("Venta no encontrada")

    prenda_result = await db.execute(
        select(Prenda).where(Prenda.id == venta.prenda_id, Prenda.usuaria_id == usuaria.id)
    )
    prenda = prenda_result.scalar_one_or_none()

    try:
        await db.delete(venta)
        if prenda is not None:
            prenda.status = "disponible"
        await db.commit()
    except Exception:
        await db.rollback()
        raise

    return None
