"""Regresiones de la revisión de octubre 2026:
- remanente de centavos a la última prenda por orden de creación
- lote ajeno rechazado al crear/mover una prenda
- no registrar dos veces la venta de la misma prenda
- la purga no borra archivos de fotos que usa otra usuaria
"""
import io
import json
import os
from datetime import datetime, timedelta, timezone

import pytest
from PIL import Image
from sqlalchemy import select

from app.core.config import Settings
from app.core.db import AsyncSessionLocal
from app.models.models import Usuaria
from scripts.purgar_usuarias import purgar

pytestmark = pytest.mark.asyncio(loop_scope="session")


def _jpeg(color=(10, 20, 30)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (64, 64), color).save(buf, format="JPEG")
    return buf.getvalue()


async def _lote(client, headers, costo=10000, piezas=3) -> str:
    r = await client.post(
        "/lotes",
        json={
            "nombre": "Lote",
            "costoTotal": costo,
            "piezasCompradas": piezas,
            "fechaCompra": "2024-09-15T00:00:00Z",
        },
        headers=headers,
    )
    assert r.status_code == 201
    return r.json()["id"]


async def _prenda(client, headers, lote_id=None, foto=None):
    data = json.dumps({"loteId": lote_id, "tipo": "blusa", "estado": "usada", "precioVenta": 5000})
    return await client.post(
        "/prendas",
        data={"data": data},
        files={"foto": ("f.jpg", foto or _jpeg(), "image/jpeg")},
        headers=headers,
    )


async def test_remanente_va_a_la_ultima_prenda_por_orden_de_creacion(client, usuaria_a):
    h = usuaria_a["headers"]
    lote_id = await _lote(client, h, costo=10000, piezas=3)  # 3333 + 3333 + 3334

    ids = []
    for i in range(3):
        r = await _prenda(client, h, lote_id, foto=_jpeg((i, i, i)))
        assert r.status_code == 201
        ids.append(r.json()["id"])

    costos = {}
    for pid in ids:
        costos[pid] = (await client.get(f"/prendas/{pid}", headers=h)).json()["costo"]

    assert sum(costos.values()) == 10000
    assert costos[ids[0]] == 3333
    assert costos[ids[1]] == 3333
    assert costos[ids[2]] == 3334  # la última creada se queda el remanente


async def test_no_se_puede_crear_prenda_en_lote_ajeno(client, usuaria_a, usuaria_b):
    lote_de_b = await _lote(client, usuaria_b["headers"])
    r = await _prenda(client, usuaria_a["headers"], lote_de_b)
    assert r.status_code == 404


async def test_no_se_puede_mover_prenda_a_lote_ajeno(client, usuaria_a, usuaria_b):
    lote_de_b = await _lote(client, usuaria_b["headers"])
    p = (await _prenda(client, usuaria_a["headers"])).json()
    r = await client.patch(f"/prendas/{p['id']}", json={"loteId": lote_de_b}, headers=usuaria_a["headers"])
    assert r.status_code == 404


async def test_no_se_vende_dos_veces_la_misma_prenda(client, usuaria_a):
    h = usuaria_a["headers"]
    p = (await _prenda(client, h)).json()
    cuerpo = {"precioFinal": 5000, "costoEnvio": 0, "comision": 0, "canal": "instagram"}

    r1 = await client.post(f"/prendas/{p['id']}/venta", json=cuerpo, headers=h)
    assert r1.status_code == 201
    r2 = await client.post(f"/prendas/{p['id']}/venta", json=cuerpo, headers=h)
    assert r2.status_code == 409
    assert r2.json()["error"]["codigo"] == "YA_VENDIDA"

    # Deshacer la venta la deja disponible y permite venderla de nuevo.
    assert (await client.delete(f"/ventas/{r1.json()['id']}", headers=h)).status_code == 204
    r3 = await client.post(f"/prendas/{p['id']}/venta", json=cuerpo, headers=h)
    assert r3.status_code == 201


async def test_purga_conserva_archivos_que_usa_otra_usuaria(client, usuaria_a, usuaria_b):
    foto = _jpeg((200, 100, 50))  # misma imagen en las dos cuentas => mismo archivo en disco
    pa = (await _prenda(client, usuaria_a["headers"], foto=foto)).json()
    pb = (await _prenda(client, usuaria_b["headers"], foto=foto)).json()

    assert pa["fotoUrl"] == pb["fotoUrl"]
    ruta = os.path.join(
        os.environ["FOTOS_DIR"], pa["fotoUrl"].split("/fotos/", 1)[1].split("?", 1)[0]
    )
    assert os.path.exists(ruta)

    # A pide borrar su cuenta y su periodo de gracia ya venció.
    assert (await client.delete("/auth/me", headers=usuaria_a["headers"])).status_code == 204
    async with AsyncSessionLocal() as db:
        a = (await db.execute(select(Usuaria).where(Usuaria.id == usuaria_a["id"]))).scalar_one()
        a.eliminada_en = datetime.now(timezone.utc) - timedelta(days=40)
        await db.commit()

    await purgar()

    assert os.path.exists(ruta), "la purga de A borró el archivo que B sigue usando"
    r = await client.get(f"/prendas/{pb['id']}", headers=usuaria_b["headers"])
    assert r.status_code == 200 and r.json()["fotoUrl"].split("?")[0] == pb["fotoUrl"].split("?")[0]


def test_jwt_secret_de_plantilla_no_arranca():
    for malo in ("", "CAMBIAME", "dev-secret-change-me"):
        with pytest.raises(ValueError):
            Settings(jwt_secret=malo)
    assert Settings(jwt_secret="x" * 40).jwt_secret == "x" * 40
