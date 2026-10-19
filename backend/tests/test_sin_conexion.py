"""Captura sin conexión: el cliente genera los ids y reintenta al volver la red.

Reglas que protegen contra duplicados y mentiras de reloj:
- crear con un id que ya existe (mismo usuario) devuelve lo ya creado, no duplica;
- el mismo id de otra usuaria responde 409 ID_EN_USO;
- la hora de captura del cliente se respeta, salvo que sea futura.
"""
import io
import json
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from PIL import Image

pytestmark = pytest.mark.asyncio(loop_scope="session")


def _jpeg(color=(1, 2, 3)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (32, 32), color).save(buf, format="JPEG")
    return buf.getvalue()


def _lote_json(**extra) -> dict:
    return {
        "nombre": "Paca offline",
        "costoTotal": 10000,
        "piezasCompradas": 2,
        "fechaCompra": "2024-09-15T00:00:00Z",
        **extra,
    }


async def _crear_prenda(client, headers, **extra):
    data = {"tipo": "blusa", "estado": "usada", "precioVenta": 5000, **extra}
    return await client.post(
        "/prendas",
        data={"data": json.dumps(data)},
        files={"foto": ("f.jpg", _jpeg((len(str(extra)) % 250, 9, 9)), "image/jpeg")},
        headers=headers,
    )


async def test_crear_lote_con_id_es_idempotente(client, usuaria_a):
    h = usuaria_a["headers"]
    lote_id = str(uuid.uuid4())
    r1 = await client.post("/lotes", json=_lote_json(id=lote_id), headers=h)
    r2 = await client.post("/lotes", json=_lote_json(id=lote_id), headers=h)
    assert r1.status_code == 201 and r2.status_code == 201
    assert r1.json()["id"] == r2.json()["id"] == lote_id

    lotes = (await client.get("/lotes", headers=h)).json()
    assert sum(1 for l in lotes if l["id"] == lote_id) == 1


async def test_id_de_otra_usuaria_da_409(client, usuaria_a, usuaria_b):
    lote_id = str(uuid.uuid4())
    assert (await client.post("/lotes", json=_lote_json(id=lote_id), headers=usuaria_a["headers"])).status_code == 201
    r = await client.post("/lotes", json=_lote_json(id=lote_id), headers=usuaria_b["headers"])
    assert r.status_code == 409
    assert r.json()["error"]["codigo"] == "ID_EN_USO"


async def test_id_invalido_da_422(client, usuaria_a):
    r = await client.post("/lotes", json=_lote_json(id="no-es-uuid"), headers=usuaria_a["headers"])
    assert r.status_code == 422


async def test_crear_prenda_con_id_es_idempotente_y_respeta_la_hora(client, usuaria_a):
    h = usuaria_a["headers"]
    prenda_id = str(uuid.uuid4())
    hace_dos_dias = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()

    r1 = await _crear_prenda(client, h, id=prenda_id, creadoEn=hace_dos_dias)
    r2 = await _crear_prenda(client, h, id=prenda_id, creadoEn=hace_dos_dias)
    assert r1.status_code == 201 and r2.status_code == 201
    assert r1.json()["id"] == r2.json()["id"] == prenda_id

    creado = datetime.fromisoformat(r1.json()["creadoEn"].replace("Z", "+00:00"))
    assert abs((creado - (datetime.now(timezone.utc) - timedelta(days=2))).total_seconds()) < 120

    todas = (await client.get("/prendas", headers=h)).json()
    assert sum(1 for p in todas if p["id"] == prenda_id) == 1


async def test_hora_futura_del_cliente_se_ignora(client, usuaria_a):
    futura = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    r = await _crear_prenda(client, usuaria_a["headers"], creadoEn=futura, color="futuro")
    assert r.status_code == 201
    creado = datetime.fromisoformat(r.json()["creadoEn"].replace("Z", "+00:00"))
    assert creado <= datetime.now(timezone.utc) + timedelta(minutes=5)


async def test_venta_con_id_es_idempotente_y_conserva_la_hora(client, usuaria_a):
    h = usuaria_a["headers"]
    p = (await _crear_prenda(client, h, color="venta")).json()
    venta_id = str(uuid.uuid4())
    hace_un_dia = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    cuerpo = {"id": venta_id, "fechaVenta": hace_un_dia, "precioFinal": 9000, "costoEnvio": 0, "comision": 0, "canal": "bazar"}

    r1 = await client.post(f"/prendas/{p['id']}/venta", json=cuerpo, headers=h)
    # Mismo id otra vez (se perdió la respuesta): NO es "ya vendida", es la misma venta.
    r2 = await client.post(f"/prendas/{p['id']}/venta", json=cuerpo, headers=h)
    assert r1.status_code == 201 and r2.status_code == 201
    assert r1.json()["id"] == r2.json()["id"] == venta_id

    ventas = (await client.get("/ventas", headers=h)).json()
    assert sum(1 for v in ventas if v["id"] == venta_id) == 1
    fecha = datetime.fromisoformat(r1.json()["fechaVenta"].replace("Z", "+00:00"))
    if fecha.tzinfo is None:
        fecha = fecha.replace(tzinfo=timezone.utc)
    assert abs((fecha - (datetime.now(timezone.utc) - timedelta(days=1))).total_seconds()) < 120

    # Con otro id, sí es una segunda venta de la misma prenda: 409.
    r3 = await client.post(f"/prendas/{p['id']}/venta", json={**cuerpo, "id": str(uuid.uuid4())}, headers=h)
    assert r3.status_code == 409
