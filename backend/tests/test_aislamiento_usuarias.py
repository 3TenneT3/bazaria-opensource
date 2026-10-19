"""Verifica que una usuaria NO puede leer/editar datos de otra (espera 404)."""
import json

import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def _crear_lote(client, headers, nombre="Lote aislamiento"):
    resp = await client.post(
        "/lotes",
        json={
            "nombre": nombre,
            "costoTotal": 1000,
            "piezasCompradas": 1,
            "piezasDescartadas": 0,
            "fechaCompra": "2024-01-01T00:00:00Z",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _crear_prenda_sin_foto_valida(client, headers):
    import io

    from PIL import Image

    img = Image.new("RGB", (50, 50), (0, 255, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    data = json.dumps({"estado": "nueva", "costo": 100, "costoManual": True, "precioVenta": 500})
    files = {"foto": ("f.png", buf.getvalue(), "image/png")}
    resp = await client.post("/prendas", data={"data": data}, files=files, headers=headers)
    assert resp.status_code == 201
    return resp.json()["id"]


async def test_usuaria_b_no_puede_leer_lote_de_a(client, usuaria_a, usuaria_b):
    lote_id = await _crear_lote(client, usuaria_a["headers"])

    resp = await client.get("/lotes", headers=usuaria_b["headers"])
    assert resp.status_code == 200
    assert lote_id not in [l["id"] for l in resp.json()]

    resp = await client.patch(
        f"/lotes/{lote_id}", json={"nombre": "hackeado"}, headers=usuaria_b["headers"]
    )
    assert resp.status_code == 404

    resp = await client.delete(f"/lotes/{lote_id}", headers=usuaria_b["headers"])
    assert resp.status_code == 404


async def test_usuaria_b_no_puede_leer_ni_editar_prenda_de_a(client, usuaria_a, usuaria_b):
    prenda_id = await _crear_prenda_sin_foto_valida(client, usuaria_a["headers"])

    resp = await client.get(f"/prendas/{prenda_id}", headers=usuaria_b["headers"])
    assert resp.status_code == 404

    resp = await client.patch(
        f"/prendas/{prenda_id}", json={"tipo": "hackeado"}, headers=usuaria_b["headers"]
    )
    assert resp.status_code == 404

    resp = await client.patch(
        f"/prendas/{prenda_id}/status", json={"status": "vendida"}, headers=usuaria_b["headers"]
    )
    assert resp.status_code == 404

    resp = await client.post(
        f"/prendas/{prenda_id}/venta",
        json={"precioFinal": 1000, "costoEnvio": 0, "comision": 0, "canal": "otro"},
        headers=usuaria_b["headers"],
    )
    assert resp.status_code == 404


async def test_usuaria_b_no_ve_prendas_de_a_en_listado(client, usuaria_a, usuaria_b):
    await _crear_prenda_sin_foto_valida(client, usuaria_a["headers"])

    resp = await client.get("/prendas", headers=usuaria_b["headers"])
    assert resp.status_code == 200
    assert resp.json() == []
