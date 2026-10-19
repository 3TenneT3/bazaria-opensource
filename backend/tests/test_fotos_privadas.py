"""Las fotos solo se abren con enlace firmado y vigente."""
import io
import json
import time

import pytest
from PIL import Image

from app.domain.fotos import enlace_valido, expiracion_enlace, firmar_enlace

pytestmark = pytest.mark.asyncio(loop_scope="session")

LLAVE = "ab/cd/" + "ab" * 32 + "_mini.webp"


def test_firma():
    e = expiracion_enlace()
    s = firmar_enlace(LLAVE, e)
    assert enlace_valido(LLAVE, str(e), s)
    assert not enlace_valido(LLAVE, str(e), s[:-1] + ("0" if s[-1] != "0" else "1"))  # firma alterada
    assert not enlace_valido(LLAVE.replace("_mini", "_detalle"), str(e), s)  # otra foto
    assert not enlace_valido(LLAVE, str(e + 1), s)  # caducidad alterada
    assert not enlace_valido(LLAVE, str(e), s, ahora=e + 1)  # caducado
    assert not enlace_valido("../../etc/passwd", str(e), s)  # ruta rara


def test_enlace_estable_durante_el_dia():
    # Mismo enlace durante el día => la caché del navegador sirve.
    base = 1_800_000_000 - (1_800_000_000 % 86400) + 100
    assert expiracion_enlace(base) == expiracion_enlace(base + 3600)
    assert expiracion_enlace(base) - base > 7 * 86400


def _jpeg() -> bytes:
    b = io.BytesIO()
    Image.new("RGB", (40, 40), (10, 120, 200)).save(b, "JPEG")
    return b.getvalue()


async def test_foto_requiere_enlace_firmado(client, usuaria_a):
    r = await client.post(
        "/prendas",
        data={"data": json.dumps({"tipo": "taza", "estado": "nueva", "costo": 100, "costoManual": True, "precioVenta": 300})},
        files={"foto": ("f.jpg", _jpeg(), "image/jpeg")},
        headers=usuaria_a["headers"],
    )
    assert r.status_code == 201, r.text
    url = r.json()["fotoUrl"]
    ruta = "/fotos/" + url.split("/fotos/", 1)[1]
    assert "?e=" in ruta and "&s=" in ruta

    ok = await client.get(ruta)
    assert ok.status_code == 200
    assert ok.headers["content-type"] == "image/webp"
    assert "private" in ok.headers["cache-control"]

    sin_firma = await client.get(ruta.split("?")[0])
    assert sin_firma.status_code == 403
    assert sin_firma.json()["error"]["codigo"] == "ENLACE_INVALIDO"

    alterada = await client.get(ruta[:-1] + ("0" if ruta[-1] != "0" else "1"))
    assert alterada.status_code == 403
