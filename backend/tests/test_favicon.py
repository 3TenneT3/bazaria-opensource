"""El panel (admin.example.com) muestra el icono de Bazaria."""
import pytest


@pytest.mark.asyncio(loop_scope="session")
async def test_favicon_servido_y_enlazado_en_login(client):
    r = await client.get("/favicon.svg")
    assert r.status_code == 200 and r.headers["content-type"].startswith("image/svg+xml")
    assert (await client.get("/favicon.ico")).status_code == 200
    login = await client.get("/admin/login")
    assert 'rel="icon" href="/favicon.svg"' in login.text
