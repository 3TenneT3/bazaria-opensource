"""Cuenta de solo lectura del panel (/admin, /flare) para colaboradores."""
import re

import pytest

from app.admin import es_escritura_admin

pytestmark = pytest.mark.asyncio(loop_scope="session")


def test_clasifica_escrituras():
    assert not es_escritura_admin("GET", "/admin/usuaria/list")
    assert not es_escritura_admin("GET", "/admin/usuaria/details/abc")
    assert not es_escritura_admin("POST", "/admin/login")
    assert es_escritura_admin("GET", "/admin/usuaria/edit/abc")
    assert es_escritura_admin("POST", "/admin/usuaria/edit/abc")
    assert es_escritura_admin("DELETE", "/admin/usuaria/delete")
    assert es_escritura_admin("POST", "/flare/api/issues/x/resolve")


async def _login(client, usuario, contrasena):
    from app.admin import intentos_login

    intentos_login._fallos.clear()
    return await client.post(
        "/admin/login", data={"username": usuario, "password": contrasena}, follow_redirects=False
    )


async def test_lector_ve_pero_no_edita(client, usuaria_a):
    r = await _login(client, "sebas-test", "lector-test-password-123")
    assert r.status_code in (302, 303), r.text
    try:
        lista = await client.get("/admin/usuaria/list")
        assert lista.status_code == 200
        # No se le muestran botones de editar ni de exportar
        assert "/admin/usuaria/edit/" not in lista.text
        assert "/export/" not in lista.text

        m = re.search(r"/admin/usuaria/details/([0-9a-f-]{36})", lista.text)
        assert m, "el lector debe poder abrir el detalle"
        uid = m.group(1)
        assert (await client.get(f"/admin/usuaria/details/{uid}")).status_code == 200

        # Aunque arme la petición a mano, el servidor la rechaza
        assert (await client.get(f"/admin/usuaria/edit/{uid}")).status_code == 403
        assert (await client.post(f"/admin/usuaria/edit/{uid}", data={"nombre": "x"})).status_code == 403
        assert (await client.delete(f"/admin/usuaria/delete?pks={uid}")).status_code == 403

        # /flare: NO entra. Ahí quedan URLs completas, incluido el enlace de un solo uso para
        # fijar la contraseña del panel; con eso un lector podría tomar la cuenta de admin.
        assert (await client.get("/flare/api/logs")).status_code == 403
        assert (await client.get("/flare")).status_code == 403
        # Exportar tampoco.
        assert (await client.get("/admin/usuaria/export/csv")).status_code == 403
    finally:
        await client.get("/admin/logout")


async def test_admin_conserva_permisos(client, usuaria_a):
    r = await _login(client, "admin-test", "admin-test-password")
    assert r.status_code in (302, 303), r.text
    try:
        lista = await client.get("/admin/usuaria/list")
        assert "/admin/usuaria/edit/" in lista.text
        uid = re.search(r"/admin/usuaria/details/([0-9a-f-]{36})", lista.text).group(1)
        assert (await client.get(f"/admin/usuaria/edit/{uid}")).status_code == 200
    finally:
        await client.get("/admin/logout")
