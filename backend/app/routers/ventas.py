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
from app.schemas import DevolucionCrear, VentaCrear, VentaOut
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
        # Si ya se había devuelto y la prenda volvió al inventario o a la papelera, la prenda ya no
        # depende de esta venta (incluso pudo venderse otra vez): no se toca.
        if prenda is not None and venta.destino_devolucion in (None, "cliente"):
            prenda.status = "disponible"
        await db.commit()
    except Exception:
        await db.rollback()
        raise

    return None


@router.post("/ventas/{venta_id}/devolucion", response_model=VentaOut)
async def registrar_devolucion(
    venta_id: IdRuta,
    data: DevolucionCrear,
    db: AsyncSession = Depends(get_db),
    usuaria: Usuaria = Depends(usuaria_actual),
):
    """Registra que la clienta devolvió la prenda o pidió un reembolso (total o parcial).

    La venta se conserva: cuenta como ingreso solo lo que no se reembolsó; el envío y la comisión
    siguen siendo gasto. La prenda vuelve al inventario, va a la papelera o se queda con la clienta.
    """
    venta = (
        await db.execute(select(Venta).where(Venta.id == venta_id, Venta.usuaria_id == usuaria.id))
    ).scalar_one_or_none()
    if venta is None:
        raise not_found("Venta no encontrada")

    if venta.devuelta_en is not None:
        # Reintento tras perder la respuesta (sin conexión): la misma devolución no es error.
        if venta.reembolso == data.reembolso and venta.destino_devolucion == data.destino:
            return venta_to_out(venta)
        raise ApiError(409, "YA_DEVUELTA", "Esta venta ya tiene una devolución registrada.")

    if data.reembolso > venta.precio_final:
        raise ApiError(
            422, "REEMBOLSO_MAYOR", "El reembolso no puede ser mayor que lo que se cobró en la venta."
        )

    prenda = (
        await db.execute(select(Prenda).where(Prenda.id == venta.prenda_id, Prenda.usuaria_id == usuaria.id))
    ).scalar_one_or_none()
    if prenda is None or prenda.status != "vendida":
        raise ApiError(409, "PRENDA_NO_VENDIDA", "La prenda de esta venta ya no está marcada como vendida.")

    ahora = datetime.now(timezone.utc)
    fecha = fecha_cliente_o_none(data.fecha_devolucion) or ahora
    if fecha < venta.fecha_venta:
        fecha = venta.fecha_venta
    try:
        venta.devuelta_en = fecha
        venta.reembolso = data.reembolso
        venta.destino_devolucion = data.destino
        if data.destino == "disponible":
            prenda.status = "disponible"
            prenda.descartada_en = None
        elif data.destino == "descartada":
            prenda.status = "descartada"
            prenda.descartada_en = ahora
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    await db.refresh(venta)
    return venta_to_out(venta)
