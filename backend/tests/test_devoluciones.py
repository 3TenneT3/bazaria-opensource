"""Devoluciones: reembolso total o parcial, qué pasa con la prenda y cómo cuenta en los reportes."""
import io
import json
import random
from datetime import datetime, timezone

import pytest
from PIL import Image

pytestmark = pytest.mark.asyncio(loop_scope="session")


def _foto() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (64, 64), tuple(random.randrange(256) for _ in range(3))).save(buf, format="JPEG")
    return buf.getvalue()


async def _prenda_vendida(client, u, costo=10000, precio=30000, envio=5000, comision=1000):
    data = json.dumps({"loteId": None, "tipo": "chamarra", "estado": "usada", "costo": costo,
                       "costoManual": True, "precioVenta": precio})
    p = await client.post("/prendas", data={"data": data}, files={"foto": ("f.jpg", _foto(), "image/jpeg")},
                          headers=u["headers"])
    assert p.status_code == 201, p.text
    v = await client.post(f"/prendas/{p.json()['id']}/venta",
                          json={"precioFinal": precio, "costoEnvio": envio, "comision": comision, "canal": "instagram"},
                          headers=u["headers"])
    assert v.status_code == 201, v.text
    return p.json(), v.json()


async def _devolver(client, u, venta_id, reembolso, destino):
    return await client.post(f"/ventas/{venta_id}/devolucion", json={"reembolso": reembolso, "destino": destino},
                             headers=u["headers"])


async def _status(client, u, prenda_id):
    return (await client.get(f"/prendas/{prenda_id}", headers=u["headers"])).json()["status"]


async def _resumen(client, u):
    hoy = datetime.now(timezone.utc)
    r = await client.get(f"/reportes/resumen-mes?anio={hoy.year}&mes={hoy.month}", headers=u["headers"])
    assert r.status_code == 200, r.text
    return r.json()


@pytest.mark.parametrize("destino,status", [("disponible", "disponible"), ("descartada", "descartada"),
                                            ("cliente", "vendida")])
async def test_destino_de_la_prenda(client, usuaria_a, destino, status):
    p, v = await _prenda_vendida(client, usuaria_a)
    r = await _devolver(client, usuaria_a, v["id"], 30000, destino)
    assert r.status_code == 200, r.text
    assert r.json()["reembolso"] == 30000 and r.json()["destinoDevolucion"] == destino and r.json()["devueltaEn"]
    assert await _status(client, usuaria_a, p["id"]) == status
    # la venta se conserva en el historial
    ventas = (await client.get("/ventas", headers=usuaria_a["headers"])).json()
    assert any(x["id"] == v["id"] and x["destinoDevolucion"] == destino for x in ventas)


async def test_reportes_cuentan_solo_lo_no_reembolsado(client, usuaria_b):
    antes = await _resumen(client, usuaria_b)
    # costo 100, precio 300, envío 50, comisión 10
    _, v1 = await _prenda_vendida(client, usuaria_b)
    _, v2 = await _prenda_vendida(client, usuaria_b)
    _, v3 = await _prenda_vendida(client, usuaria_b)
    # v1: vuelve completa al inventario -> ingreso 0, sin costo de prenda, pierde envío+comisión (-60)
    assert (await _devolver(client, usuaria_b, v1["id"], 30000, "disponible")).status_code == 200
    # v2: reembolso parcial de 100, la clienta se la queda -> 200 - 100 - 50 - 10 = +40
    assert (await _devolver(client, usuaria_b, v2["id"], 10000, "cliente")).status_code == 200
    # v3: llegó dañada, reembolso total -> 0 - 100 - 50 - 10 = -160
    assert (await _devolver(client, usuaria_b, v3["id"], 30000, "descartada")).status_code == 200
    despues = await _resumen(client, usuaria_b)
    assert despues["totalVentas"] - antes["totalVentas"] == 0 + 20000 + 0
    assert despues["gananciaNeta"] - antes["gananciaNeta"] == -6000 + 4000 - 16000
    assert despues["numeroPrendasVendidas"] - antes["numeroPrendasVendidas"] == 1  # solo la que se quedó la clienta


async def test_reembolso_mayor_que_la_venta_se_rechaza(client, usuaria_a):
    _, v = await _prenda_vendida(client, usuaria_a)
    r = await _devolver(client, usuaria_a, v["id"], 30001, "disponible")
    assert r.status_code == 422 and r.json()["error"]["codigo"] == "REEMBOLSO_MAYOR"
    r = await _devolver(client, usuaria_a, v["id"], -1, "disponible")
    assert r.status_code == 422


async def test_reintento_identico_no_es_error_y_otra_devolucion_si(client, usuaria_a):
    _, v = await _prenda_vendida(client, usuaria_a)
    assert (await _devolver(client, usuaria_a, v["id"], 5000, "cliente")).status_code == 200
    assert (await _devolver(client, usuaria_a, v["id"], 5000, "cliente")).status_code == 200
    r = await _devolver(client, usuaria_a, v["id"], 9000, "cliente")
    assert r.status_code == 409 and r.json()["error"]["codigo"] == "YA_DEVUELTA"


async def test_no_se_devuelve_venta_ajena(client, usuaria_a, usuaria_b):
    _, v = await _prenda_vendida(client, usuaria_a)
    assert (await _devolver(client, usuaria_b, v["id"], 100, "disponible")).status_code == 404


async def test_devuelta_al_inventario_se_puede_vender_otra_vez(client, usuaria_a):
    p, v = await _prenda_vendida(client, usuaria_a)
    assert (await _devolver(client, usuaria_a, v["id"], 30000, "disponible")).status_code == 200
    v2 = await client.post(f"/prendas/{p['id']}/venta", json={"precioFinal": 25000, "canal": "bazar"},
                           headers=usuaria_a["headers"])
    assert v2.status_code == 201
    # Borrar la venta vieja (ya devuelta) NO debe regresar a disponible la prenda que se volvió a vender
    assert (await client.delete(f"/ventas/{v['id']}", headers=usuaria_a["headers"])).status_code == 204
    assert await _status(client, usuaria_a, p["id"]) == "vendida"
    # Y la venta vieja ya devuelta no admite otra devolución sobre la prenda vendida de nuevo
    r = await _devolver(client, usuaria_a, v2.json()["id"], 0, "cliente")
    assert r.status_code == 200


async def test_resumen_de_lote_resta_el_reembolso(client, usuaria_a):
    lote = await client.post("/lotes", json={"nombre": "paca", "costoTotal": 100000, "piezasCompradas": 2,
                                             "piezasDescartadas": 0, "fechaCompra": "2026-10-01T00:00:00Z"},
                             headers=usuaria_a["headers"])
    lote_id = lote.json()["id"]
    data = json.dumps({"loteId": lote_id, "tipo": "blusa", "estado": "usada", "costo": 0,
                       "costoManual": False, "precioVenta": 40000})
    p = await client.post("/prendas", data={"data": data}, files={"foto": ("f.jpg", _foto(), "image/jpeg")},
                          headers=usuaria_a["headers"])
    v = await client.post(f"/prendas/{p.json()['id']}/venta", json={"precioFinal": 40000, "canal": "bazar"},
                          headers=usuaria_a["headers"])
    await _devolver(client, usuaria_a, v.json()["id"], 15000, "cliente")
    r = (await client.get(f"/reportes/resumen-lote/{lote_id}", headers=usuaria_a["headers"])).json()
    assert r["recuperado"] == 25000
