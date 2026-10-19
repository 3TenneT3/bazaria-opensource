"""Inyecciones y entradas maliciosas: se guardan como texto o se rechazan, nunca se ejecutan."""
import io
import json

import pytest
from PIL import Image
from sqlalchemy import func, select

from app.core.db import AsyncSessionLocal
from app.models.models import Usuaria

pytestmark = pytest.mark.asyncio(loop_scope="session")

SQLI = [
    "'; DROP TABLE usuarias; --",
    "' OR '1'='1",
    "blusa' UNION SELECT email, google_sub FROM usuarias --",
    "1); DELETE FROM prendas; --",
]
XSS = '<script>alert(1)</script><img src=x onerror=alert(2)>'


def _jpeg() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (32, 32), (10, 200, 30)).save(buf, format="JPEG")
    return buf.getvalue()


async def _contar_usuarias() -> int:
    async with AsyncSessionLocal() as db:
        return await db.scalar(select(func.count()).select_from(Usuaria))


@pytest.mark.parametrize("payload", SQLI + [XSS])
async def test_texto_malicioso_se_guarda_tal_cual_y_no_se_ejecuta(client, usuaria_a, payload):
    antes = await _contar_usuarias()
    data = json.dumps(
        {"loteId": None, "tipo": payload, "marca": payload, "estado": "nueva",
         "costo": 0, "costoManual": False, "precioVenta": 0}
    )
    r = await client.post("/prendas", data={"data": data}, files={"foto": ("f.jpg", _jpeg(), "image/jpeg")},
                          headers=usuaria_a["headers"])
    assert r.status_code == 201
    assert r.json()["tipo"] == payload  # texto literal: ni SQL ni HTML interpretado
    assert await _contar_usuarias() == antes  # nada borrado ni alterado
    lote = await client.post("/lotes", json={"nombre": payload, "costoTotal": 100, "piezasCompradas": 1,
                                             "piezasDescartadas": 0, "fechaCompra": "2026-10-01T00:00:00Z"},
                             headers=usuaria_a["headers"])
    assert lote.status_code == 201 and lote.json()["nombre"] == payload


@pytest.mark.parametrize("malo", ["1 OR 1=1", "' OR '1'='1", "../../etc/passwd", "00000000-0000-0000-0000-000000000000' --"])
async def test_ids_maliciosos_no_pasan(client, usuaria_a, malo):
    for ruta in (f"/prendas/{malo}", f"/lotes/{malo}"):
        r = await client.patch(ruta, json={"nombre": "x"}, headers=usuaria_a["headers"])
        assert r.status_code in (404, 405, 422), (ruta, r.status_code)
    for ruta in (f"/reportes/lote/{malo}", f"/ventas/{malo}"):
        r = await client.get(ruta, headers=usuaria_a["headers"])
        assert r.status_code < 500, (ruta, r.status_code)


async def test_lote_id_malicioso_en_el_cuerpo_da_422(client, usuaria_a):
    data = json.dumps({"loteId": "' OR 1=1 --", "tipo": "x", "estado": "nueva", "costo": 0,
                       "costoManual": False, "precioVenta": 0})
    r = await client.post("/prendas", data={"data": data}, files={"foto": ("f.jpg", _jpeg(), "image/jpeg")},
                          headers=usuaria_a["headers"])
    assert r.status_code == 422


@pytest.mark.parametrize(
    "ruta",
    [
        "/fotos/../../app/core/config.py",
        "/fotos/..%2f..%2fetc%2fpasswd",
        "/fotos/ab/cd/" + "a" * 64 + "_mini.webp/../../../../etc/passwd",
        "/fotos/%2e%2e/%2e%2e/etc/passwd?e=9999999999&s=x",
    ],
)
async def test_fotos_no_permiten_leer_otros_archivos(client, ruta):
    r = await client.get(ruta)
    assert r.status_code in (403, 404)
    assert b"root:" not in r.content and b"jwt_secret" not in r.content


async def test_token_falso_o_manipulado_no_entra(client, usuaria_a):
    cab, carga, firma = usuaria_a["token"].split(".")
    for t in ("x.y.z", f"{cab}.{carga}.", f"{cab}.{carga}.AAAA", "' OR 1=1 --"):
        r = await client.get("/auth/me", headers={"Authorization": f"Bearer {t}"})
        assert r.status_code == 401
