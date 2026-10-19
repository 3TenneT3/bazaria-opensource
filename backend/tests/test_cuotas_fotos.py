"""Cuotas de fotos por usuaria: espacio por plan (413) y fotos nuevas por hora (429)."""
import io
import json
import random

import pytest
from PIL import Image
from sqlalchemy import update

from app.core.config import get_settings
from app.core.db import AsyncSessionLocal
from app.domain.cuotas import cuota_bytes
from app.models.models import Usuaria

pytestmark = pytest.mark.asyncio(loop_scope="session")

_DATA = json.dumps(
    {"loteId": None, "tipo": "blusa", "estado": "nueva", "costo": 0, "costoManual": False, "precioVenta": 0}
)


def _foto_distinta() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (64, 64), tuple(random.randrange(256) for _ in range(3))).save(buf, format="JPEG")
    return buf.getvalue()


async def _subir(client, usuaria, contenido: bytes):
    files = {"foto": ("f.jpg", contenido, "image/jpeg")}
    return await client.post("/prendas", data={"data": _DATA}, files=files, headers=usuaria["headers"])


@pytest.fixture
def ajustes():
    s = get_settings()
    antes = (s.cuota_fotos_mb_gratis, s.cuota_fotos_mb_premium, s.fotos_por_hora)
    yield s
    s.cuota_fotos_mb_gratis, s.cuota_fotos_mb_premium, s.fotos_por_hora = antes


def test_cuota_por_plan():
    assert cuota_bytes("gratis") == 500 * 1024 * 1024
    assert cuota_bytes("premium") == 5000 * 1024 * 1024


async def test_limite_por_hora_da_429_y_las_repetidas_no_cuentan(client, usuaria_a, ajustes):
    ajustes.fotos_por_hora = 2
    repetida = _foto_distinta()
    assert (await _subir(client, usuaria_a, repetida)).status_code == 201
    assert (await _subir(client, usuaria_a, _foto_distinta())).status_code == 201
    r = await _subir(client, usuaria_a, _foto_distinta())
    assert r.status_code == 429
    assert r.json()["error"]["codigo"] == "LIMITE_SUBIDAS"
    # Duplicar una prenda con una foto que ya tiene no gasta cuota.
    assert (await _subir(client, usuaria_a, repetida)).status_code == 201


async def test_espacio_lleno_da_413_y_premium_tiene_mas(client, usuaria_b, ajustes):
    ajustes.cuota_fotos_mb_gratis = 0  # cualquier foto nueva ya excede
    r = await _subir(client, usuaria_b, _foto_distinta())
    assert r.status_code == 413
    assert r.json()["error"]["codigo"] == "CUOTA_FOTOS"
    async with AsyncSessionLocal() as db:
        await db.execute(update(Usuaria).where(Usuaria.id == usuaria_b["id"]).values(plan="premium"))
        await db.commit()
    assert (await _subir(client, usuaria_b, _foto_distinta())).status_code == 201


async def test_auth_me_informa_espacio_usado_y_cuota(client, usuaria_a):
    antes = (await client.get("/auth/me", headers=usuaria_a["headers"])).json()
    assert antes["fotosBytesCuota"] == cuota_bytes(antes["plan"])
    assert (await _subir(client, usuaria_a, _foto_distinta())).status_code == 201
    despues = (await client.get("/auth/me", headers=usuaria_a["headers"])).json()
    assert despues["fotosBytesUsados"] > antes["fotosBytesUsados"]
