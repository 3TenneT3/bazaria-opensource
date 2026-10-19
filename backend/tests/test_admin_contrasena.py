"""Cambiar la contraseña del panel desde el panel y con enlace de un solo uso."""
import pytest

from app.admin import crear_enlace, intentos_login
from app.core import contrasenas

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def _login(client, usuario, contrasena):
    intentos_login._fallos.clear()
    r = await client.post("/admin/login", data={"username": usuario, "password": contrasena}, follow_redirects=False)
    return r.status_code in (302, 303) and "/admin/login" not in r.headers.get("location", "")


@pytest.fixture(autouse=True)
async def _limpiar_cuentas():
    from sqlalchemy import text

    from app.core.db import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        await db.execute(text("delete from admin_cuentas"))
        await db.commit()
    yield
    async with AsyncSessionLocal() as db:
        await db.execute(text("delete from admin_cuentas"))
        await db.commit()


def test_hash_y_reglas():
    h = contrasenas.hashear("bazaria-cartas-2026")
    assert "bazaria" not in h
    assert contrasenas.verificar("bazaria-cartas-2026", h)
    assert not contrasenas.verificar("otra-cosa-1234", h)
    assert contrasenas.problema("corta", "corta")
    assert contrasenas.problema("bazaria-cartas-2026", "bazaria-cartas-2027")
    assert contrasenas.problema("bazaria-cartas-2026", "bazaria-cartas-2026") is None


async def test_cambiar_desde_el_panel(client):
    assert await _login(client, "admin-test", "admin-test-password")
    r = await client.post("/admin/mi-cuenta", data={"actual": "mala", "nueva": "x" * 12, "repetida": "x" * 12})
    assert "no es correcta" in r.text
    r = await client.post(
        "/admin/mi-cuenta",
        data={"actual": "admin-test-password", "nueva": "bazaria-cartas-2026", "repetida": "bazaria-cartas-2026"},
    )
    assert "Listo" in r.text
    await client.get("/admin/logout")
    # La del .env ya no sirve; la nueva sí
    assert not await _login(client, "admin-test", "admin-test-password")
    assert await _login(client, "admin-test", "bazaria-cartas-2026")
    await client.get("/admin/logout")


async def test_lector_puede_cambiar_la_suya(client):
    assert await _login(client, "sebas-test", "lector-test-password-123")
    r = await client.post(
        "/admin/mi-cuenta",
        data={"actual": "lector-test-password-123", "nueva": "sebas-nueva-clave", "repetida": "sebas-nueva-clave"},
    )
    assert r.status_code == 200 and "Listo" in r.text
    await client.get("/admin/logout")
    assert await _login(client, "sebas-test", "sebas-nueva-clave")
    await client.get("/admin/logout")


async def test_enlace_de_un_solo_uso(client):
    token = await crear_enlace("admin-test")
    r = await client.get(f"/admin/fijar-contrasena?token={token}")
    assert r.status_code == 200 and "admin-test" in r.text
    r = await client.post(
        "/admin/fijar-contrasena", data={"token": token, "nueva": "por-enlace-2026", "repetida": "por-enlace-2026"}
    )
    assert "Listo" in r.text
    assert await _login(client, "admin-test", "por-enlace-2026")
    await client.get("/admin/logout")
    # Ya no sirve otra vez
    r = await client.get(f"/admin/fijar-contrasena?token={token}")
    assert r.status_code == 410
    r = await client.post(
        "/admin/fijar-contrasena", data={"token": token, "nueva": "otra-clave-2026", "repetida": "otra-clave-2026"}
    )
    assert r.status_code == 410


async def test_enlace_falso_o_vacio(client):
    intentos_login._fallos.clear()
    assert (await client.get("/admin/fijar-contrasena?token=inventado")).status_code == 410
    assert (await client.get("/admin/fijar-contrasena")).status_code == 410
    intentos_login._fallos.clear()
