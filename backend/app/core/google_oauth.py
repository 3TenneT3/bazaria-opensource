from __future__ import annotations

import time
from urllib.parse import urlencode

import httpx
import jwt

from app.core.config import get_settings

GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GOOGLE_CERTS_ENDPOINT = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_SCOPES = "openid email profile"


def build_authorize_url(state: str, code_challenge: str) -> str:
    settings = get_settings()
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_callback_url,
        "response_type": "code",
        "scope": GOOGLE_SCOPES,
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        "access_type": "online",
        "prompt": "select_account",
    }
    return f"{GOOGLE_AUTH_ENDPOINT}?{urlencode(params)}"


async def exchange_code_for_tokens(code: str, code_verifier: str) -> dict:
    settings = get_settings()
    data = {
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
        "code": code,
        "code_verifier": code_verifier,
        "grant_type": "authorization_code",
        "redirect_uri": settings.google_callback_url,
    }
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(GOOGLE_TOKEN_ENDPOINT, data=data)
        resp.raise_for_status()
        return resp.json()


_jwks_cache: dict | None = None
_jwks_obtenido: float = 0.0
_JWKS_TTL_S = 3600  # Google rota sus llaves cada pocas semanas: refrescar cada hora


async def _descargar_jwks() -> dict:
    global _jwks_cache, _jwks_obtenido
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(GOOGLE_CERTS_ENDPOINT)
        resp.raise_for_status()
        llaves = resp.json()
    _jwks_cache, _jwks_obtenido = llaves, time.monotonic()
    return llaves


async def _get_google_jwks(kid: str | None = None) -> dict:
    """Llaves públicas de Google. Se refrescan cada hora y, además, si el id_token viene
    firmado con una llave (`kid`) que no conocemos: sin esto, el día que Google rota sus
    llaves nadie puede iniciar sesión hasta reiniciar la API."""
    vencida = time.monotonic() - _jwks_obtenido > _JWKS_TTL_S
    if _jwks_cache is None or vencida:
        return await _descargar_jwks()
    if kid and kid not in {k.get("kid") for k in _jwks_cache.get("keys", [])}:
        return await _descargar_jwks()
    return _jwks_cache


async def verificar_id_token(id_token: str, access_token: str | None = None) -> dict:
    """Verifica firma (RS256 con la llave de Google indicada por `kid`), aud, iss, exp y
    email_verified. Lanza ValueError si es inválido.

    PyJWT no revisa `at_hash`; en el flujo de código (el id_token llega directo de Google por
    TLS en el intercambio del code) es opcional según OpenID Connect. `access_token` se acepta
    por compatibilidad y no se usa. Se evita PyJWKClient a propósito (concentra las fallas
    publicadas de PyJWT): las llaves las descarga `_get_google_jwks`.
    """
    settings = get_settings()
    try:
        kid = jwt.get_unverified_header(id_token).get("kid")
        if not kid:
            raise ValueError("id_token sin kid")
        jwks = await _get_google_jwks(kid)
        jwk = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
        if jwk is None:
            raise ValueError("kid desconocido para Google")
        llave = jwt.PyJWK.from_dict(jwk, algorithm="RS256")
        claims = jwt.decode(
            id_token,
            llave,
            algorithms=["RS256"],
            audience=settings.google_client_id,
            issuer=["https://accounts.google.com", "accounts.google.com"],
            options={"require": ["exp", "iat", "iss", "aud", "sub"]},
            leeway=30,
        )
    except ValueError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"id_token inválido: {exc}") from exc

    if not claims.get("email_verified"):
        raise ValueError("email no verificado por Google")

    return claims
