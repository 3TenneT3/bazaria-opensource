"""El panel de diagnóstico /flare no debe ser público.

Regresión: la dependencia de auth devolvía False en vez de lanzar, y
FastAPI ignora el valor de retorno de una dependencia, así que /flare
quedaba abierto en cualquier host del contenedor (incluido
api.example.com).
"""
import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")


@pytest.mark.parametrize("ruta", ["/flare", "/flare/api/logs", "/flare/api/issues"])
async def test_flare_sin_sesion_de_admin_da_401(client, ruta):
    r = await client.get(ruta)
    assert r.status_code == 401
    assert "error" in r.json()


async def test_jwt_de_usuaria_no_abre_flare(client, usuaria_a):
    r = await client.get("/flare/api/logs", headers=usuaria_a["headers"])
    assert r.status_code == 401


async def test_admin_sin_sesion_redirige_a_login(client):
    r = await client.get("/admin/", follow_redirects=False)
    assert r.status_code in (302, 307)
    assert "/admin/login" in r.headers["location"]
