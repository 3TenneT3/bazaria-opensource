"""Papelera: descartar -> borrar definitivo (libera la foto) y borrado automático a los 30 días."""
import io
import json
import os
import random
from datetime import datetime, timedelta, timezone

import pytest
from PIL import Image
from sqlalchemy import select, update

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
    Image.new("RGB", (64, 64), tuple(random.randrange(256) for _ in range(3))).save(buf, format="JPEG")
    return buf.getvalue()


async def _crear(client, usuaria, contenido: bytes) -> dict:
    files = {"foto": ("f.jpg", contenido, "image/jpeg")}
    resp = await client.post("/prendas", data={"data": _DATA}, files=files, headers=usuaria["headers"])
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _descartar(client, usuaria, prenda_id: str) -> dict:
    resp = await client.patch(f"/prendas/{prenda_id}/status", json={"status": "descartada"}, headers=usuaria["headers"])
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _uso(usuaria) -> int:
    async with AsyncSessionLocal() as db:
        return await uso_fotos(db, usuaria["id"])


async def _sha_de(prenda_id: str) -> str:
    async with AsyncSessionLocal() as db:
        foto_id = await db.scalar(select(Prenda.foto_id).where(Prenda.id == prenda_id))
        return await db.scalar(select(Foto.sha256).where(Foto.id == foto_id))


def _archivo_existe(sha: str) -> bool:
    return os.path.exists(AlmacenLocal()._ruta(llave_variante(sha, "mini")))


async def test_borrar_exige_papelera(client, usuaria_a):
    p = await _crear(client, usuaria_a, _foto_distinta())
    resp = await client.delete(f"/prendas/{p['id']}", headers=usuaria_a["headers"])
    assert resp.status_code == 409
    assert resp.json()["error"]["codigo"] == "NO_EN_PAPELERA"
    assert (await client.get(f"/prendas/{p['id']}", headers=usuaria_a["headers"])).status_code == 200


async def test_descartar_marca_fecha_y_restaurar_la_limpia(client, usuaria_a):
    p = await _crear(client, usuaria_a, _foto_distinta())
    assert p["descartadaEn"] is None
    assert (await _descartar(client, usuaria_a, p["id"]))["descartadaEn"] is not None
    resp = await client.patch(f"/prendas/{p['id']}/status", json={"status": "disponible"}, headers=usuaria_a["headers"])
    assert resp.json()["descartadaEn"] is None


async def test_borrar_definitivo_libera_foto_y_espacio(client, usuaria_a):
    p = await _crear(client, usuaria_a, _foto_distinta())
    sha = await _sha_de(p["id"])
    assert await _uso(usuaria_a) > 0 and _archivo_existe(sha)

    await _descartar(client, usuaria_a, p["id"])
    assert (await client.delete(f"/prendas/{p['id']}", headers=usuaria_a["headers"])).status_code == 204

    assert (await client.get(f"/prendas/{p['id']}", headers=usuaria_a["headers"])).status_code == 404
    assert await _uso(usuaria_a) == 0
    assert not _archivo_existe(sha)


async def test_foto_compartida_se_libera_con_la_ultima(client, usuaria_a):
    contenido = _foto_distinta()
    a = await _crear(client, usuaria_a, contenido)
    b = await _crear(client, usuaria_a, contenido)  # mismo archivo: comparten foto
    sha = await _sha_de(a["id"])

    await _descartar(client, usuaria_a, a["id"])
    await client.delete(f"/prendas/{a['id']}", headers=usuaria_a["headers"])
    assert await _uso(usuaria_a) > 0 and _archivo_existe(sha)  # b todavía la usa

    await _descartar(client, usuaria_a, b["id"])
    await client.delete(f"/prendas/{b['id']}", headers=usuaria_a["headers"])
    assert await _uso(usuaria_a) == 0 and not _archivo_existe(sha)


async def test_no_se_borra_prenda_ajena(client, usuaria_a, usuaria_b):
    p = await _crear(client, usuaria_a, _foto_distinta())
    await _descartar(client, usuaria_a, p["id"])
    assert (await client.delete(f"/prendas/{p['id']}", headers=usuaria_b["headers"])).status_code == 404
    assert (await client.get(f"/prendas/{p['id']}", headers=usuaria_a["headers"])).status_code == 200


async def test_papelera_se_vacia_sola_a_los_30_dias(client, usuaria_a):
    vieja = await _crear(client, usuaria_a, _foto_distinta())
    reciente = await _crear(client, usuaria_a, _foto_distinta())
    sha_vieja = await _sha_de(vieja["id"])
    for p in (vieja, reciente):
        await _descartar(client, usuaria_a, p["id"])
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(Prenda).where(Prenda.id == vieja["id"]).values(descartada_en=datetime.now(timezone.utc) - timedelta(days=31))
        )
        await db.commit()

    ids = [x["id"] for x in (await client.get("/prendas", headers=usuaria_a["headers"])).json()]
    assert vieja["id"] not in ids and reciente["id"] in ids
    assert not _archivo_existe(sha_vieja)
