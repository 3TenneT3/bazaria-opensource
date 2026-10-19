from __future__ import annotations

import hashlib
import json
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.db import get_db
from app.core.deps import usuaria_actual
from app.core.errors import fecha_cliente_o_none, id_en_uso, not_found, validacion, IdRuta
from app.domain.cuotas import exigir_cuota_para_foto_nueva
from app.domain.fotos import (
    AlmacenLocal,
    MAX_BYTES,
    FotoInvalida,
    llave_variante,
    normalizar_y_generar_variantes,
    sha_en_uso,
)
from app.models.models import Foto, Lote, Prenda, Usuaria
from app.schemas import PrendaActualizar, PrendaCrearData, PrendaOut, PrendaStatusUpdate
from app.routers.lotes import exigir_lote_propio, recalcular_prorrateo
from app.serializers import cargar_fotos, prenda_to_out

router = APIRouter(prefix="/prendas", tags=["prendas"])


async def _get_foto(db: AsyncSession, foto_id: str | None) -> Foto | None:
    if foto_id is None:
        return None
    result = await db.execute(select(Foto).where(Foto.id == foto_id))
    return result.scalar_one_or_none()


@router.get("", response_model=list[PrendaOut])
async def listar_prendas(
    status: Optional[str] = None,
    tipo: Optional[str] = None,
    talla: Optional[str] = None,
    loteId: Optional[str] = None,
    texto: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    usuaria: Usuaria = Depends(usuaria_actual),
):
    query = select(Prenda).where(Prenda.usuaria_id == usuaria.id)
    if status:
        query = query.where(Prenda.status == status)
    if tipo:
        query = query.where(Prenda.tipo == tipo)
    if talla:
        query = query.where(Prenda.talla == talla)
    if loteId:
        query = query.where(Prenda.lote_id == loteId)
    if texto:
        patron = f"%{texto}%"
        query = query.where(
            or_(
                Prenda.tipo.ilike(patron),
                Prenda.color.ilike(patron),
                Prenda.marca.ilike(patron),
                Prenda.talla.ilike(patron),
            )
        )
    query = query.order_by(Prenda.creada_en.desc())
    result = await db.execute(query)
    prendas = result.scalars().all()

    fotos = await cargar_fotos(db, [p.foto_id for p in prendas])
    return [prenda_to_out(p, fotos.get(p.foto_id)) for p in prendas]


@router.get("/{prenda_id}", response_model=PrendaOut)
async def obtener_prenda(
    prenda_id: IdRuta,
    db: AsyncSession = Depends(get_db),
    usuaria: Usuaria = Depends(usuaria_actual),
):
    result = await db.execute(
        select(Prenda).where(Prenda.id == prenda_id, Prenda.usuaria_id == usuaria.id)
    )
    prenda = result.scalar_one_or_none()
    if prenda is None:
        raise not_found("Prenda no encontrada")
    foto = await _get_foto(db, prenda.foto_id)
    return prenda_to_out(prenda, foto)


@router.post("", response_model=PrendaOut, status_code=201)
async def crear_prenda(
    foto: UploadFile = File(...),
    data: str = Form(...),
    db: AsyncSession = Depends(get_db),
    usuaria: Usuaria = Depends(usuaria_actual),
):
    try:
        payload = PrendaCrearData.model_validate(json.loads(data))
    except (json.JSONDecodeError, ValueError) as exc:
        raise validacion(f"data inválido: {exc}") from exc

    if payload.id:
        # Reintento tras perder la respuesta: devolver la prenda que ya se creó, no duplicarla.
        existente = (await db.execute(select(Prenda).where(Prenda.id == payload.id))).scalar_one_or_none()
        if existente is not None:
            if existente.usuaria_id != usuaria.id:
                raise id_en_uso()
            return prenda_to_out(existente, await _get_foto(db, existente.foto_id))

    # El lote debe ser de la usuaria: sin esto se podría colgar una prenda de un lote ajeno.
    lote = None
    if payload.lote_id is not None:
        lote = await exigir_lote_propio(db, payload.lote_id, usuaria.id)

    # No leer a memoria un archivo de más de 5 MB (Starlette ya lo tiene en un temporal y sabe
    # su tamaño). Caddy además corta cuerpos de más de 6 MB antes de que lleguen aquí.
    if foto.size is not None and foto.size > MAX_BYTES:
        raise validacion("La foto excede el tamaño máximo de 5MB")
    contenido = await foto.read(MAX_BYTES + 1)
    if len(contenido) > MAX_BYTES:
        raise validacion("La foto excede el tamaño máximo de 5MB")

    # Primero el hash del archivo recibido (milisegundos). Si esta usuaria ya tiene exactamente esa
    # foto (p. ej. al duplicar una prenda 10 veces), se reutiliza sin volver a pasarla por Pillow.
    # Es el mismo hash que guarda normalizar_y_generar_variantes (sha256 del archivo original).
    sha = hashlib.sha256(contenido).hexdigest()
    foto_row = (
        await db.execute(select(Foto).where(Foto.usuaria_id == usuaria.id, Foto.sha256 == sha))
    ).scalar_one_or_none()

    normalizada = None
    if foto_row is None:
        await exigir_cuota_para_foto_nueva(db, usuaria)  # antes de gastar CPU en Pillow
        try:
            # En un hilo: procesar la foto (~0.3–0.6 s de CPU) dentro del bucle async congelaba la
            # API para todas mientras durara. Pillow suelta el GIL, así que además corre en paralelo.
            normalizada = await run_in_threadpool(normalizar_y_generar_variantes, contenido)
        except FotoInvalida as exc:
            raise validacion(str(exc)) from exc

    almacen = AlmacenLocal()
    archivos_escritos: list[str] = []

    try:
        if foto_row is None:
            assert normalizada is not None
            # Los archivos se nombran solo por hash: si otra usuaria ya subió la misma imagen,
            # el archivo existe y es suyo también. No lo reescribimos ni lo registramos para
            # borrarlo si esta transacción falla.
            ya_en_disco = await sha_en_uso(db, normalizada.sha256)
            if not ya_en_disco:
                for variante, contenido_bytes in normalizada.variantes.items():
                    llave = llave_variante(normalizada.sha256, variante)
                    almacen.guardar(llave, contenido_bytes)
                    archivos_escritos.append(llave)

            foto_row = Foto(
                usuaria_id=usuaria.id,
                sha256=normalizada.sha256,
                llave=f"{normalizada.sha256[0:2]}/{normalizada.sha256[2:4]}/{normalizada.sha256}",
                mime="image/webp",
                bytes_=sum(len(v) for v in normalizada.variantes.values()),  # lo que ocupa en disco
                ancho=normalizada.ancho,
                alto=normalizada.alto,
            )
            db.add(foto_row)
            await db.flush()

        prenda = Prenda(
            **({"id": payload.id} if payload.id else {}),
            **({"creada_en": c} if (c := fecha_cliente_o_none(payload.creado_en)) else {}),
            usuaria_id=usuaria.id,
            lote_id=payload.lote_id,
            foto_id=foto_row.id,
            tipo=payload.tipo,
            color=payload.color,
            talla=payload.talla,
            marca=payload.marca,
            estado=payload.estado,
            costo=payload.costo,
            costo_manual=payload.costo_manual,
            precio_venta=payload.precio_venta,
        )
        db.add(prenda)
        await db.flush()

        if lote is not None:
            await recalcular_prorrateo(db, lote)

        await db.commit()
    except Exception:
        await db.rollback()
        for llave in archivos_escritos:
            almacen.borrar(llave)
        raise

    await db.refresh(prenda)
    return prenda_to_out(prenda, foto_row)


@router.patch("/{prenda_id}", response_model=PrendaOut)
async def actualizar_prenda(
    prenda_id: IdRuta,
    data: PrendaActualizar,
    db: AsyncSession = Depends(get_db),
    usuaria: Usuaria = Depends(usuaria_actual),
):
    result = await db.execute(
        select(Prenda).where(Prenda.id == prenda_id, Prenda.usuaria_id == usuaria.id)
    )
    prenda = result.scalar_one_or_none()
    if prenda is None:
        raise not_found("Prenda no encontrada")

    campos = data.model_dump(exclude_unset=True)
    if campos.get("lote_id") is not None:
        await exigir_lote_propio(db, campos["lote_id"], usuaria.id)

    lote_ids_a_recalcular = set()
    if prenda.lote_id:
        lote_ids_a_recalcular.add(prenda.lote_id)

    for campo, valor in campos.items():
        setattr(prenda, campo, valor)

    if "lote_id" in campos and prenda.lote_id:
        lote_ids_a_recalcular.add(prenda.lote_id)

    for lote_id in lote_ids_a_recalcular:
        lote = (
            await db.execute(select(Lote).where(Lote.id == lote_id, Lote.usuaria_id == usuaria.id))
        ).scalar_one_or_none()
        if lote is not None:
            await recalcular_prorrateo(db, lote)

    await db.commit()
    await db.refresh(prenda)
    foto = await _get_foto(db, prenda.foto_id)
    return prenda_to_out(prenda, foto)


@router.patch("/{prenda_id}/status", response_model=PrendaOut)
async def actualizar_status_prenda(
    prenda_id: IdRuta,
    data: PrendaStatusUpdate,
    db: AsyncSession = Depends(get_db),
    usuaria: Usuaria = Depends(usuaria_actual),
):
    result = await db.execute(
        select(Prenda).where(Prenda.id == prenda_id, Prenda.usuaria_id == usuaria.id)
    )
    prenda = result.scalar_one_or_none()
    if prenda is None:
        raise not_found("Prenda no encontrada")

    status_anterior = prenda.status
    prenda.status = data.status

    # Entrar o salir de "descartada" cambia cuántas prendas se reparten el costo del lote.
    # (Antes solo se recalculaba al descartar: restaurar una prenda dejaba los costos mal.)
    if prenda.lote_id and "descartada" in (status_anterior, data.status) and status_anterior != data.status:
        lote_result = await db.execute(
            select(Lote).where(Lote.id == prenda.lote_id, Lote.usuaria_id == usuaria.id)
        )
        lote = lote_result.scalar_one_or_none()
        if lote is not None:
            await recalcular_prorrateo(db, lote)

    await db.commit()
    await db.refresh(prenda)
    foto = await _get_foto(db, prenda.foto_id)
    return prenda_to_out(prenda, foto)
