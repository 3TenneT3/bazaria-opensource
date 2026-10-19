"""Verifica el flujo completo de soft delete + purga:
- DELETE /me marca eliminada_en (no borra nada).
- La usuaria pierde acceso inmediato (401 en cualquier endpoint).
- scripts.purgar_usuarias.purgar() NO toca cuentas dentro del periodo de
  gracia, y SÍ borra definitivamente (cascada) las que ya vencieron.
"""
import json
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.core.db import AsyncSessionLocal
from app.models.models import Lote, Usuaria
from scripts.purgar_usuarias import purgar

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def test_delete_me_marca_soft_delete_y_bloquea_acceso(client, usuaria_a):
    resp = await client.delete("/auth/me", headers=usuaria_a["headers"])
    assert resp.status_code == 204

    # El mismo JWT ya no sirve para nada: usuaria_actual debe rechazar con 401.
    resp2 = await client.get("/lotes", headers=usuaria_a["headers"])
    assert resp2.status_code == 401

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Usuaria).where(Usuaria.id == usuaria_a["id"]))
        usuaria = result.scalar_one()
        assert usuaria.eliminada_en is not None


async def test_purga_no_toca_cuentas_dentro_del_periodo_de_gracia(client, usuaria_b):
    resp = await client.delete("/auth/me", headers=usuaria_b["headers"])
    assert resp.status_code == 204

    eliminadas = await purgar()
    assert eliminadas == 0  # recién eliminada, dentro del periodo de gracia

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Usuaria).where(Usuaria.id == usuaria_b["id"]))
        assert result.scalar_one_or_none() is not None  # sigue en la DB


async def test_purga_borra_definitivamente_tras_vencer_el_periodo_de_gracia(client, usuaria_a, usuaria_b):
    # Crear una usuaria nueva con datos, eliminarla "hace 40 días" (simulado
    # directo en DB) y verificar que la purga la borra en cascada.
    async with AsyncSessionLocal() as db:
        nueva = Usuaria(google_sub="sub-purga-test", email="purgar@example.com")
        db.add(nueva)
        await db.commit()
        await db.refresh(nueva)

        lote = Lote(
            usuaria_id=nueva.id,
            nombre="Lote a purgar",
            costo_total=1000,
            piezas_compradas=1,
            fecha_compra=datetime.now(timezone.utc),
        )
        db.add(lote)
        await db.commit()

        nueva.eliminada_en = datetime.now(timezone.utc) - timedelta(days=40)
        await db.commit()
        nueva_id = nueva.id

    eliminadas = await purgar()
    assert eliminadas >= 1

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Usuaria).where(Usuaria.id == nueva_id))
        assert result.scalar_one_or_none() is None  # purgada de verdad

        lotes_result = await db.execute(select(Lote).where(Lote.usuaria_id == nueva_id))
        assert lotes_result.scalar_one_or_none() is None  # cascada funcionó
