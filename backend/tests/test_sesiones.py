"""Sesiones: 14 días y "cerrar sesión en todos lados" (versión de sesión por usuaria)."""
from datetime import datetime, timezone

import pytest
import jwt

from app.core.config import get_settings
from app.core.db import AsyncSessionLocal
from app.core.security import crear_jwt
from app.models.models import Usuaria

pytestmark = pytest.mark.asyncio(loop_scope="session")


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def test_cerrar_sesiones_invalida_todos_los_tokens(client, usuaria_a):
    otro_dispositivo = crear_jwt(usuaria_a["id"], 0)
    assert (await client.get("/auth/me", headers=usuaria_a["headers"])).status_code == 200
    assert (await client.get("/auth/me", headers=_h(otro_dispositivo))).status_code == 200

    r = await client.post("/auth/cerrar-sesiones", headers=usuaria_a["headers"])
    assert r.status_code == 204

    for token in (usuaria_a["token"], otro_dispositivo):
        r = await client.get("/auth/me", headers=_h(token))
        assert r.status_code == 401
        assert "sesión cerrada" in r.text

    # Un inicio de sesión nuevo (versión actual) sí funciona.
    async with AsyncSessionLocal() as db:
        version = (await db.get(Usuaria, usuaria_a["id"])).version_sesion
    assert version == 1
    assert (await client.get("/auth/me", headers=_h(crear_jwt(usuaria_a["id"], version)))).status_code == 200


async def test_token_viejo_sin_version_vale_solo_mientras_no_se_cierre(client, usuaria_b):
    s = get_settings()
    ahora = int(datetime.now(timezone.utc).timestamp())
    viejo = jwt.encode({"sub": usuaria_b["id"], "iat": ahora, "exp": ahora + 3600}, s.jwt_secret, algorithm="HS256")
    assert (await client.get("/auth/me", headers=_h(viejo))).status_code == 200
    await client.post("/auth/cerrar-sesiones", headers=_h(viejo))
    assert (await client.get("/auth/me", headers=_h(viejo))).status_code == 401


async def test_cerrar_sesiones_exige_sesion(client):
    assert (await client.post("/auth/cerrar-sesiones")).status_code == 401


def test_la_sesion_dura_14_dias():
    s = get_settings()
    claims = jwt.decode(crear_jwt("u", 0), s.jwt_secret, algorithms=["HS256"])
    assert claims["exp"] - claims["iat"] == 14 * 24 * 3600
    assert claims["sv"] == 0
