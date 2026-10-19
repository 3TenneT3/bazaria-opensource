from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.fotos import AlmacenLocal, llave_variante
from app.models.models import Foto, Lote, Prenda, Venta
from app.schemas import LoteOut, PrendaOut, VentaOut


async def cargar_fotos(db: AsyncSession, foto_ids: list[str | None]) -> dict[str, Foto]:
    """Trae las fotos de varias prendas en una sola consulta (evita N+1)."""
    ids = {i for i in foto_ids if i}
    if not ids:
        return {}
    result = await db.execute(select(Foto).where(Foto.id.in_(ids)))
    return {f.id: f for f in result.scalars().all()}


def lote_to_out(lote: Lote) -> LoteOut:
    return LoteOut.model_validate(lote, from_attributes=True)


def prenda_to_out(prenda: Prenda, foto: Foto | None) -> PrendaOut:
    foto_url = None
    foto_mini_url = None
    if foto is not None:
        almacen = AlmacenLocal()
        foto_url = almacen.url(llave_variante(foto.sha256, "detalle"))
        foto_mini_url = almacen.url(llave_variante(foto.sha256, "mini"))

    return PrendaOut(
        id=prenda.id,
        loteId=prenda.lote_id,
        fotoUrl=foto_url,
        fotoMiniUrl=foto_mini_url,
        tipo=prenda.tipo,
        color=prenda.color,
        talla=prenda.talla,
        marca=prenda.marca,
        estado=prenda.estado,
        costo=prenda.costo,
        costoManual=prenda.costo_manual,
        precioVenta=prenda.precio_venta,
        status=prenda.status,
        creadoEn=prenda.creada_en,
    )


def venta_to_out(venta: Venta) -> VentaOut:
    return VentaOut.model_validate(venta, from_attributes=True)
