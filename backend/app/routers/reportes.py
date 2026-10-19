from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import usuaria_actual
from app.core.errors import not_found, IdRuta
from app.domain.costos import recuperacion_lote
from app.models.models import Foto, Lote, Prenda, Usuaria, Venta
from app.schemas import ResumenLoteOut, ResumenMesOut, TopTipoOut
from app.serializers import cargar_fotos, lote_to_out, prenda_to_out

router = APIRouter(prefix="/reportes", tags=["reportes"])


@router.get("/resumen-mes", response_model=ResumenMesOut)
async def resumen_mes(
    anio: int = Query(...),
    mes: int = Query(..., ge=1, le=12),
    db: AsyncSession = Depends(get_db),
    usuaria: Usuaria = Depends(usuaria_actual),
):
    inicio = date(anio, mes, 1)
    fin = date(anio + 1, 1, 1) if mes == 12 else date(anio, mes + 1, 1)

    ventas_result = await db.execute(
        select(Venta).where(
            Venta.usuaria_id == usuaria.id,
            Venta.fecha_venta >= inicio,
            Venta.fecha_venta < fin,
        )
    )
    ventas = ventas_result.scalars().all()

    total_ventas = sum(v.precio_final for v in ventas)
    numero_prendas_vendidas = len(ventas)

    ganancia_por_tipo: dict[str, int] = {}
    ganancia_neta = 0

    # Una sola consulta con todas las prendas vendidas del mes (antes: una por venta).
    prenda_ids = {v.prenda_id for v in ventas}
    prendas_por_id: dict[str, Prenda] = {}
    if prenda_ids:
        r = await db.execute(
            select(Prenda).where(Prenda.id.in_(prenda_ids), Prenda.usuaria_id == usuaria.id)
        )
        prendas_por_id = {p.id: p for p in r.scalars().all()}

    for venta in ventas:
        prenda = prendas_por_id.get(venta.prenda_id)
        costo = prenda.costo if prenda else 0
        ganancia = venta.precio_final - costo - venta.costo_envio - venta.comision
        ganancia_neta += ganancia
        tipo = (prenda.tipo if prenda else None) or "sin_tipo"
        ganancia_por_tipo[tipo] = ganancia_por_tipo.get(tipo, 0) + ganancia

    top_tipos = [
        TopTipoOut(tipo=tipo, ganancia=ganancia)
        for tipo, ganancia in sorted(ganancia_por_tipo.items(), key=lambda kv: kv[1], reverse=True)
    ]

    hace_30_dias = date.today() - timedelta(days=30)
    estancadas_result = await db.execute(
        select(Prenda).where(
            Prenda.usuaria_id == usuaria.id,
            Prenda.status.in_(("disponible", "apartada")),
            Prenda.creada_en < hace_30_dias,
        )
    )
    estancadas = estancadas_result.scalars().all()
    fotos = await cargar_fotos(db, [p.foto_id for p in estancadas])
    prendas_estancadas = [prenda_to_out(p, fotos.get(p.foto_id)) for p in estancadas]

    return ResumenMesOut(
        anio=anio,
        mes=mes,
        totalVentas=total_ventas,
        gananciaNeta=ganancia_neta,
        numeroPrendasVendidas=numero_prendas_vendidas,
        topTipos=top_tipos,
        prendasEstancadas=prendas_estancadas,
    )


@router.get("/resumen-lote/{lote_id}", response_model=ResumenLoteOut)
async def resumen_lote(
    lote_id: IdRuta,
    db: AsyncSession = Depends(get_db),
    usuaria: Usuaria = Depends(usuaria_actual),
):
    lote_result = await db.execute(
        select(Lote).where(Lote.id == lote_id, Lote.usuaria_id == usuaria.id)
    )
    lote = lote_result.scalar_one_or_none()
    if lote is None:
        raise not_found("Lote no encontrado")

    prendas_result = await db.execute(
        select(Prenda).where(Prenda.lote_id == lote.id, Prenda.usuaria_id == usuaria.id)
    )
    prenda_ids = [p.id for p in prendas_result.scalars().all()]

    precios_finales: list[int] = []
    if prenda_ids:
        ventas_result = await db.execute(
            select(Venta).where(Venta.prenda_id.in_(prenda_ids), Venta.usuaria_id == usuaria.id)
        )
        precios_finales = [v.precio_final for v in ventas_result.scalars().all()]

    calc = recuperacion_lote(lote.costo_total, precios_finales)

    piezas_validas = lote.piezas_compradas - lote.piezas_descartadas
    costo_unitario_actual = (lote.costo_total // piezas_validas) if piezas_validas > 0 else 0

    return ResumenLoteOut(
        lote=lote_to_out(lote),
        recuperado=calc["recuperado"],
        faltante=calc["faltante"],
        costoUnitarioActual=costo_unitario_actual,
    )
