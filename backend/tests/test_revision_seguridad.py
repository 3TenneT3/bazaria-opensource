"""Regresiones de la revisión de seguridad y consistencia (oct 2026)."""
import io
import json

import pytest
from PIL import Image

from app.admin import IntentosLogin, credenciales_validas

pytestmark = pytest.mark.asyncio(loop_scope="session")


def _jpeg(color) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (32, 32), color).save(buf, format="JPEG")
    return buf.getvalue()


async def test_restaurar_prenda_descartada_vuelve_a_cuadrar_el_lote(client, usuaria_a):
    h = usuaria_a["headers"]
    lote = (await client.post(
        "/lotes",
        json={"nombre": "Lote", "costoTotal": 10000, "piezasCompradas": 3, "fechaCompra": "2024-09-15T00:00:00Z"},
        headers=h,
    )).json()
    ids = []
    for i in range(3):
        data = json.dumps({"loteId": lote["id"], "tipo": "blusa", "estado": "usada"})
        r = await client.post("/prendas", data={"data": data}, files={"foto": ("f.jpg", _jpeg((i, 40, 80)), "image/jpeg")}, headers=h)
        ids.append(r.json()["id"])

    async def suma() -> int:
        # sum() no puede recorrer un generador con await adentro: se suma en un for.
        total = 0
        for i in ids:
            total += (await client.get(f"/prendas/{i}", headers=h)).json()["costo"]
        return total

    assert await suma() == 10000  # 3333 + 3333 + 3334

    # Descartar la última (la que tenía el centavo extra) y luego restaurarla.
    assert (await client.patch(f"/prendas/{ids[2]}/status", json={"status": "descartada"}, headers=h)).status_code == 200
    assert (await client.patch(f"/prendas/{ids[2]}/status", json={"status": "disponible"}, headers=h)).status_code == 200

    # Antes del arreglo quedaban dos prendas con el centavo extra: 10001.
    assert await suma() == 10000


def test_bloqueo_por_intentos_fallidos():
    intentos = IntentosLogin(max_fallos=3, ventana_s=60)
    for t in range(3):
        assert not intentos.bloqueada("1.2.3.4", ahora=100 + t)
        intentos.fallo("1.2.3.4", ahora=100 + t)
    assert intentos.bloqueada("1.2.3.4", ahora=103)
    assert not intentos.bloqueada("5.6.7.8", ahora=103)  # otra IP no se ve afectada
    assert not intentos.bloqueada("1.2.3.4", ahora=200)  # pasada la ventana se libera


def test_credenciales_en_tiempo_constante():
    assert credenciales_validas("admin", "secreta", "admin", "secreta")
    assert not credenciales_validas("admin", "otra", "admin", "secreta")
    assert not credenciales_validas("otro", "secreta", "admin", "secreta")


@pytest.mark.parametrize("ruta", ["/docs", "/redoc", "/openapi.json"])
async def test_documentacion_de_la_api_oculta_por_defecto(client, ruta):
    assert (await client.get(ruta)).status_code == 404
