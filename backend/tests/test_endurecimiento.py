"""Endurecimiento del panel y de las fotos (auditoría del 16 oct 2026)."""
import pytest

from app.admin import es_escritura_admin
from app.core import contrasenas
from app.core.config import get_settings

pytestmark = pytest.mark.asyncio(loop_scope="session")


def test_exportar_cuenta_como_escritura_para_el_lector():
    assert es_escritura_admin("GET", "/admin/usuaria/export/csv")
    assert es_escritura_admin("GET", "/admin/prenda/export/json")
    assert not es_escritura_admin("GET", "/admin/usuaria/list")


def test_contrasenas_nuevas_usan_scrypt_mas_costoso():
    h = contrasenas.hashear("una-contrasena-bastante-larga")
    assert h.split("$")[1] == str(2**16)
    assert contrasenas.verificar("una-contrasena-bastante-larga", h)
    assert not contrasenas.verificar("otra-contrasena-distinta", h)


@pytest.fixture
def panel_en_su_dominio():
    s = get_settings()
    anterior = s.admin_host
    s.admin_host = "admin.example.com"
    yield
    s.admin_host = anterior


@pytest.mark.parametrize("ruta", ["/admin/login", "/flare"])
async def test_panel_no_responde_en_el_dominio_de_la_api(client, panel_en_su_dominio, ruta):
    r = await client.get(ruta, headers={"Host": "api.example.com"})
    assert r.status_code == 404


async def test_panel_si_responde_en_su_dominio(client, panel_en_su_dominio):
    r = await client.get("/admin/login", headers={"Host": "admin.example.com"})
    assert r.status_code == 200


async def test_la_api_sigue_respondiendo_en_su_dominio(client, panel_en_su_dominio):
    r = await client.get("/health", headers={"Host": "api.example.com"})
    assert r.status_code == 200


async def test_foto_rechazada_no_se_cachea(client):
    r = await client.get("/fotos/ab/cd/" + "a" * 64 + "_mini.webp?e=1&s=x")
    assert r.status_code == 403
    assert "immutable" not in r.headers.get("cache-control", "")


async def test_foto_repetida_no_se_vuelve_a_procesar(client, usuaria_a, monkeypatch):
    import io
    import json

    from PIL import Image

    import app.routers.prendas as rutas

    llamadas = []
    original = rutas.normalizar_y_generar_variantes

    def contando(contenido):
        llamadas.append(1)
        return original(contenido)

    monkeypatch.setattr(rutas, "normalizar_y_generar_variantes", contando)

    buf = io.BytesIO()
    Image.new("RGB", (64, 64), (12, 34, 56)).save(buf, format="JPEG")
    foto = buf.getvalue()
    data = json.dumps({"tipo": "blusa", "estado": "usada"})
    urls = []
    for _ in range(3):  # como "duplicar prenda": la misma foto varias veces
        r = await client.post(
            "/prendas", data={"data": data}, files={"foto": ("f.jpg", foto, "image/jpeg")}, headers=usuaria_a["headers"]
        )
        assert r.status_code == 201
        urls.append(r.json()["fotoUrl"].split("?")[0])

    assert len(llamadas) == 1  # solo la primera pasa por Pillow
    assert len(set(urls)) == 1  # las tres prendas comparten la misma foto


async def test_panel_manda_una_sola_cookie_de_sesion(client):
    from app.admin import intentos_login

    intentos_login._fallos.clear()  # otras pruebas pudieron dejar intentos fallidos
    r = await client.post("/admin/login", data={"username": "admin-test", "password": "admin-test-password"})
    cookies = [v for k, v in r.headers.multi_items() if k.lower() == "set-cookie" and v.startswith("session=")]
    assert len(cookies) == 1, cookies
    await client.get("/admin/logout")
