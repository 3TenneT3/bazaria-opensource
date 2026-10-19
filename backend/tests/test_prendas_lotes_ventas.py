import io

import pytest
from PIL import Image

pytestmark = pytest.mark.asyncio(loop_scope="session")


def _crear_jpeg_bytes(color=(255, 0, 0), size=(200, 200)) -> bytes:
    img = Image.new("RGB", size, color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


async def test_lote_crear_y_listar(client, usuaria_a):
    resp = await client.post(
        "/lotes",
        json={
            "nombre": "Paca test",
            "costoTotal": 10000,
            "piezasCompradas": 2,
            "piezasDescartadas": 0,
            "fechaCompra": "2024-09-15T00:00:00Z",
            "notas": None,
        },
        headers=usuaria_a["headers"],
    )
    assert resp.status_code == 201
    lote = resp.json()
    assert lote["nombre"] == "Paca test"
    assert lote["costoTotal"] == 10000

    resp = await client.get("/lotes", headers=usuaria_a["headers"])
    assert resp.status_code == 200
    assert len(resp.json()) == 1


async def test_prenda_crear_con_foto_y_prorrateo(client, usuaria_a):
    lote_resp = await client.post(
        "/lotes",
        json={
            "nombre": "Lote prorrateo",
            "costoTotal": 10000,
            "piezasCompradas": 2,
            "piezasDescartadas": 0,
            "fechaCompra": "2024-09-15T00:00:00Z",
        },
        headers=usuaria_a["headers"],
    )
    lote_id = lote_resp.json()["id"]

    import json as jsonlib

    data = jsonlib.dumps(
        {
            "loteId": lote_id,
            "tipo": "blusa",
            "color": "lila",
            "talla": "M",
            "marca": None,
            "estado": "seminueva",
            "costo": 0,
            "costoManual": False,
            "precioVenta": 15000,
        }
    )
    files = {"foto": ("foto.jpg", _crear_jpeg_bytes(), "image/jpeg")}
    resp = await client.post(
        "/prendas", data={"data": data}, files=files, headers=usuaria_a["headers"]
    )
    assert resp.status_code == 201
    prenda = resp.json()
    assert prenda["fotoUrl"] is not None
    assert prenda["fotoMiniUrl"] is not None
    # lote con 2 piezas compradas, costoTotal 10000 -> costo unitario 5000
    assert prenda["costo"] == 5000


async def test_prenda_foto_invalida_422(client, usuaria_a):
    import json as jsonlib

    data = jsonlib.dumps(
        {
            "loteId": None,
            "tipo": "blusa",
            "estado": "nueva",
            "costo": 0,
            "costoManual": False,
            "precioVenta": 0,
        }
    )
    files = {"foto": ("foto.jpg", b"esto-no-es-una-imagen", "image/jpeg")}
    resp = await client.post(
        "/prendas", data={"data": data}, files=files, headers=usuaria_a["headers"]
    )
    assert resp.status_code == 422


async def test_venta_marca_prenda_vendida_en_transaccion(client, usuaria_a):
    import json as jsonlib

    data = jsonlib.dumps(
        {"loteId": None, "estado": "nueva", "costo": 5000, "costoManual": True, "precioVenta": 15000}
    )
    files = {"foto": ("foto.jpg", _crear_jpeg_bytes(), "image/jpeg")}
    prenda_resp = await client.post(
        "/prendas", data={"data": data}, files=files, headers=usuaria_a["headers"]
    )
    prenda_id = prenda_resp.json()["id"]

    venta_resp = await client.post(
        f"/prendas/{prenda_id}/venta",
        json={"precioFinal": 15000, "costoEnvio": 1000, "comision": 0, "canal": "instagram"},
        headers=usuaria_a["headers"],
    )
    assert venta_resp.status_code == 201

    prenda_check = await client.get(f"/prendas/{prenda_id}", headers=usuaria_a["headers"])
    assert prenda_check.json()["status"] == "vendida"

    venta_id = venta_resp.json()["id"]
    del_resp = await client.delete(f"/ventas/{venta_id}", headers=usuaria_a["headers"])
    assert del_resp.status_code == 204

    prenda_check2 = await client.get(f"/prendas/{prenda_id}", headers=usuaria_a["headers"])
    assert prenda_check2.json()["status"] == "disponible"


async def test_reportes_resumen_mes_responde(client, usuaria_a):
    resp = await client.get("/reportes/resumen-mes?anio=2024&mes=3", headers=usuaria_a["headers"])
    assert resp.status_code == 200
    body = resp.json()
    assert body["anio"] == 2024
    assert body["mes"] == 3
