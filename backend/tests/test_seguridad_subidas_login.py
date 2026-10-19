"""Seguridad de subidas y del login con Google (revisión del 19 oct 2026)."""
import io
import json

import pytest
from PIL import Image

from app.core import google_oauth
from app.domain import fotos

pytestmark = pytest.mark.asyncio(loop_scope="session")

_DATA = json.dumps(
    {"loteId": None, "tipo": "blusa", "estado": "nueva", "costo": 0, "costoManual": False, "precioVenta": 0}
)


def _png(ancho: int, alto: int) -> bytes:
    buf = io.BytesIO()
    Image.new("1", (ancho, alto)).save(buf, format="PNG", optimize=True)  # 1 bit/px: comprime muchísimo
    return buf.getvalue()


def test_bomba_de_descompresion_se_rechaza_sin_decodificarla():
    bomba = _png(10_000, 6_000)  # 60 MP en unos KB
    assert len(bomba) < fotos.MAX_BYTES
    with pytest.raises(fotos.FotoInvalida, match="megapíxeles"):
        fotos.normalizar_y_generar_variantes(bomba)


def test_foto_normal_sigue_pasando():
    buf = io.BytesIO()
    Image.new("RGB", (1280, 960), (200, 120, 90)).save(buf, format="JPEG")
    r = fotos.normalizar_y_generar_variantes(buf.getvalue())
    assert r.ancho == 1280 and set(r.variantes) == {"mini", "detalle"}


async def test_subida_de_mas_de_5mb_da_422(client, usuaria_a):
    files = {"foto": ("grande.jpg", b"\xff" * (fotos.MAX_BYTES + 10), "image/jpeg")}
    r = await client.post("/prendas", data={"data": _DATA}, files=files, headers=usuaria_a["headers"])
    assert r.status_code == 422
    assert "5MB" in r.text


async def test_llaves_de_google_se_refrescan_si_llega_un_kid_desconocido(monkeypatch):
    descargas = []

    async def falsa():
        descargas.append(1)
        llaves = {"keys": [{"kid": f"k{len(descargas)}"}]}
        google_oauth._jwks_cache, google_oauth._jwks_obtenido = llaves, google_oauth.time.monotonic()
        return llaves

    monkeypatch.setattr(google_oauth, "_descargar_jwks", falsa)
    monkeypatch.setattr(google_oauth, "_jwks_cache", None)
    await google_oauth._get_google_jwks("k1")  # primera vez: descarga
    await google_oauth._get_google_jwks("k1")  # conocida y vigente: usa caché
    assert len(descargas) == 1
    llaves = await google_oauth._get_google_jwks("k2")  # Google rotó: vuelve a descargar
    assert len(descargas) == 2 and llaves["keys"][0]["kid"] == "k2"


async def test_llaves_de_google_caducan_a_la_hora(monkeypatch):
    descargas = []

    async def falsa():
        descargas.append(1)
        llaves = {"keys": [{"kid": "k"}]}
        google_oauth._jwks_cache, google_oauth._jwks_obtenido = llaves, google_oauth.time.monotonic()
        return llaves

    monkeypatch.setattr(google_oauth, "_descargar_jwks", falsa)
    monkeypatch.setattr(google_oauth, "_jwks_cache", {"keys": [{"kid": "k"}]})
    monkeypatch.setattr(google_oauth, "_jwks_obtenido", google_oauth.time.monotonic() - 3601)
    await google_oauth._get_google_jwks("k")
    assert len(descargas) == 1
