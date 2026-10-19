"""Verificación del id_token de Google con PyJWT: casos válidos y ataques conocidos."""
import base64
import time

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from app.core import google_oauth
from app.core.config import get_settings

pytestmark = pytest.mark.asyncio(loop_scope="session")

_LLAVE = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_OTRA = rsa.generate_private_key(public_exponent=65537, key_size=2048)


def _jwk(llave, kid: str) -> dict:
    d = jwt.algorithms.RSAAlgorithm.to_jwk(llave.public_key(), as_dict=True)
    return {**d, "kid": kid, "alg": "RS256", "use": "sig"}


def _claims(**cambios) -> dict:
    ahora = int(time.time())
    c = {
        "iss": "https://accounts.google.com",
        "aud": get_settings().google_client_id,
        "sub": "123",
        "email": "a@b.com",
        "email_verified": True,
        "iat": ahora,
        "exp": ahora + 600,
    }
    c.update(cambios)
    return c


def _token(claims: dict, llave=_LLAVE, kid="k1", alg="RS256") -> str:
    return jwt.encode(claims, llave, algorithm=alg, headers={"kid": kid})


@pytest.fixture(autouse=True)
def jwks_falso(monkeypatch):
    async def falso(kid=None):
        return {"keys": [_jwk(_LLAVE, "k1")]}

    monkeypatch.setattr(google_oauth, "_get_google_jwks", falso)


async def test_token_valido():
    c = await google_oauth.verificar_id_token(_token(_claims()))
    assert c["sub"] == "123"


@pytest.mark.parametrize(
    "claims",
    [
        _claims(aud="otra-app.apps.googleusercontent.com"),  # token emitido para otra app
        _claims(iss="https://accounts.google.com.evil.com"),  # emisor falso / coincidencia parcial
        _claims(exp=int(time.time()) - 3600),  # vencido
        _claims(email_verified=False),  # correo sin verificar
    ],
)
async def test_claims_invalidos_se_rechazan(claims):
    with pytest.raises(ValueError):
        await google_oauth.verificar_id_token(_token(claims))


async def test_firma_con_otra_llave_se_rechaza():
    with pytest.raises(ValueError):
        await google_oauth.verificar_id_token(_token(_claims(), llave=_OTRA))


async def test_kid_desconocido_se_rechaza():
    with pytest.raises(ValueError):
        await google_oauth.verificar_id_token(_token(_claims(), kid="no-existe"))


async def test_alg_none_se_rechaza():
    sin_firma = jwt.encode(_claims(), None, algorithm="none", headers={"kid": "k1"})
    with pytest.raises(ValueError):
        await google_oauth.verificar_id_token(sin_firma)


async def test_confusion_hs256_con_la_llave_publica_se_rechaza():
    # Ataque clásico: firmar HS256 usando la llave PÚBLICA de Google como secreto.
    pem = _LLAVE.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
    falso = _token(_claims(), llave=base64.b64encode(pem), alg="HS256")
    with pytest.raises(ValueError):
        await google_oauth.verificar_id_token(falso)


async def test_sesion_propia_rechaza_alg_none_y_tokens_sin_exp():
    from app.core.security import decodificar_jwt

    s = get_settings()
    assert decodificar_jwt(jwt.encode({"sub": "u", "iat": 1, "exp": 9999999999}, None, algorithm="none")) is None
    assert decodificar_jwt(jwt.encode({"sub": "u", "iat": int(time.time())}, s.jwt_secret, algorithm="HS256")) is None
