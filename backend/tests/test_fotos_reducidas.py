"""Quitar la foto grande de prendas vendidas: queda la miniatura, los datos y se libera espacio."""
import io
import json
import os
import random

import pytest
from PIL import Image
from sqlalchemy import select

from app.core.db import AsyncSessionLocal
from app.domain.cuotas import uso_fotos
from app.domain.fotos import AlmacenLocal, llave_variante
from app.models.models import Foto, Prenda

pytestmark = pytest.mark.asyncio(loop_scope="session")

_DATA = json.dumps(
    {"loteId": None, "tipo": "blusa", "estado": "nueva", "costo": 0, "costoManual": False, "precioVenta": 0}
)


def _foto_distinta() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (1400, 1400), tuple(random.randrange(256) for _ in range(3))).save(buf, format="JPEG")
    return buf.getvalue()


async def _crear(client, usuaria, contenido: bytes) -> dict:
    files = {"foto": ("f.jpg", contenido, "image/jpeg")}
    resp = await client.post("/prendas", data={"data": _DATA}, files=files, headers=usuaria["headers"])
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _vender(client, usuaria, prenda_id: str) -> None:
    resp = await client.post(
        f"/prendas/{prenda_id}/venta",
        json={"precioFinal": 15000, "costoEnvio": 0, "comision": 0, "canal": "instagram"},
        headers=usuaria["headers"],
    )
    assert resp.status_code == 201, resp.text


async def _liberar(client, usuaria, ids=None):
    cuerpo = {} if ids is None else {"ids": ids}
    return await client.post("/prendas/liberar-fotos", json=cuerpo, headers=usuaria["headers"])


async def _uso(usuaria) -> int:
    async with AsyncSessionLocal() as db:
        return await uso_fotos(db, usuaria["id"])


async def _sha_de(prenda_id: str) -> str:
    async with AsyncSessionLocal() as db:
        foto_id = await db.scalar(select(Prenda.foto_id).where(Prenda.id == prenda_id))
        return await db.scalar(select(Foto.sha256).where(Foto.id == foto_id))


def _existe(sha: str, variante: str) -> bool:
    return os.path.exists(AlmacenLocal()._ruta(llave_variante(sha, variante)))


async def test_libera_la_grande_y_deja_la_miniatura(client, usuaria_a):
    p = await _crear(client, usuaria_a, _foto_distinta())
    sha = await _sha_de(p["id"])
    await _vender(client, usuaria_a, p["id"])
    antes = await _uso(usuaria_a)

    resp = await _liberar(client, usuaria_a, [p["id"]])
    assert resp.status_code == 200
    assert resp.json()["liberados"] == 1 and resp.json()["bytesLiberados"] > 0

    assert not _existe(sha, "detalle") and _existe(sha, "mini")
    assert await _uso(usuaria_a) == antes - resp.json()["bytesLiberados"]
    actual = (await client.get(f"/prendas/{p['id']}", headers=usuaria_a["headers"])).json()
    assert actual["fotoReducida"] is True and actual["fotoUrl"] == actual["fotoMiniUrl"]
    assert actual["status"] == "vendida"  # los datos de la venta no cambian


async def test_no_toca_prendas_no_vendidas(client, usuaria_a):
    p = await _crear(client, usuaria_a, _foto_distinta())
    sha = await _sha_de(p["id"])
    resp = await _liberar(client, usuaria_a, [p["id"]])
    assert resp.json()["liberados"] == 0
    assert _existe(sha, "detalle")


async def test_foto_compartida_con_una_disponible_no_se_reduce(client, usuaria_a):
    contenido = _foto_distinta()
    vendida = await _crear(client, usuaria_a, contenido)
    duplicado = await _crear(client, usuaria_a, contenido)  # misma foto, sigue disponible
    sha = await _sha_de(vendida["id"])
    await _vender(client, usuaria_a, vendida["id"])

    assert (await _liberar(client, usuaria_a)).json()["liberados"] == 0
    assert _existe(sha, "detalle")

    await _vender(client, usuaria_a, duplicado["id"])  # ahora ambas vendidas
    assert (await _liberar(client, usuaria_a)).json()["liberados"] == 1
    assert not _existe(sha, "detalle")


async def test_sin_ids_reduce_todas_las_vendidas_y_es_idempotente(client, usuaria_a):
    a = await _crear(client, usuaria_a, _foto_distinta())
    b = await _crear(client, usuaria_a, _foto_distinta())
    await _vender(client, usuaria_a, a["id"])
    await _vender(client, usuaria_a, b["id"])
    assert (await _liberar(client, usuaria_a)).json()["liberados"] == 2
    assert (await _liberar(client, usuaria_a)).json()["liberados"] == 0


async def test_no_reduce_fotos_ajenas(client, usuaria_a, usuaria_b):
    p = await _crear(client, usuaria_a, _foto_distinta())
    sha = await _sha_de(p["id"])
    await _vender(client, usuaria_a, p["id"])
    assert (await _liberar(client, usuaria_b, [p["id"]])).json()["liberados"] == 0
    assert _existe(sha, "detalle")


async def test_misma_imagen_de_otra_usuaria_conserva_la_grande_en_disco(client, usuaria_a, usuaria_b):
    contenido = _foto_distinta()
    a = await _crear(client, usuaria_a, contenido)
    await _crear(client, usuaria_b, contenido)  # la comparte por hash
    sha = await _sha_de(a["id"])
    await _vender(client, usuaria_a, a["id"])
    assert (await _liberar(client, usuaria_a)).json()["liberados"] == 1
    assert _existe(sha, "detalle")  # la otra usuaria todavía la necesita


async def test_subir_otra_vez_la_misma_imagen_recupera_la_grande(client, usuaria_a):
    contenido = _foto_distinta()
    p = await _crear(client, usuaria_a, contenido)
    sha = await _sha_de(p["id"])
    await _vender(client, usuaria_a, p["id"])
    await _liberar(client, usuaria_a)
    assert not _existe(sha, "detalle")

    nueva = await _crear(client, usuaria_a, contenido)
    assert _existe(sha, "detalle")
    assert nueva["fotoReducida"] is False
