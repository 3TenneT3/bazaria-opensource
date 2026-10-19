"""Plan gratis/premium, /auth/me y vista de uso por usuaria."""
import pytest
from sqlalchemy import select

from app.admin import intentos_login
from app.core.db import AsyncSessionLocal
from app.models.models import Usuaria

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def test_me_trae_plan(client, usuaria_a):
    r = await client.get("/auth/me", headers=usuaria_a["headers"])
    assert r.status_code == 200
    assert r.json()["plan"] == "gratis"
    assert r.json()["iaDisponible"] is False

    async with AsyncSessionLocal() as db:
        u = (await db.execute(select(Usuaria).where(Usuaria.id == usuaria_a["id"]))).scalar_one()
        u.plan = "premium"
        await db.commit()
    r = await client.get("/auth/me", headers=usuaria_a["headers"])
    assert r.json()["plan"] == "premium"
    assert r.json()["iaDisponible"] is False  # premium pero sin IA conectada todavía


async def test_vista_uso_por_usuaria(client, usuaria_a):
    intentos_login._fallos.clear()
    await client.post("/admin/login", data={"username": "sebas-test", "password": "lector-test-password-123"})
    r = await client.get("/admin/uso-por-usuaria")
    assert r.status_code == 200
    assert "Uso por usuaria" in r.text and "MB" in r.text
    await client.get("/admin/logout")
