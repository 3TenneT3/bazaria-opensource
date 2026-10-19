from __future__ import annotations

import base64
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import jwt

from app.core.config import get_settings


def crear_jwt(usuaria_id: str, version_sesion: int = 0) -> str:
    settings = get_settings()
    ahora = datetime.now(timezone.utc)
    payload = {
        "sub": usuaria_id,
        "sv": version_sesion,  # ver Usuaria.version_sesion
        "iat": int(ahora.timestamp()),
        "exp": int((ahora + timedelta(days=settings.jwt_expire_days)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decodificar_jwt(token: str) -> tuple[str, int] | None:
    """Devuelve (usuaria_id, version_sesion) o None si el token es inválido o venció.
    Los tokens anteriores a la versión de sesión no traen "sv": cuentan como versión 0."""
    settings = get_settings()
    try:
        # options nuevo en cada llamada (PyJWT CVE-2026-103001: no reutilizar el dict de options).
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "iat", "sub"]},
        )
    except jwt.PyJWTError:
        return None
    sub, sv = payload.get("sub"), payload.get("sv", 0)
    if not sub or not isinstance(sv, int):
        return None
    return sub, sv


def generar_state() -> str:
    return secrets.token_urlsafe(32)


def generar_pkce_pair() -> tuple[str, str]:
    """Devuelve (code_verifier, code_challenge) para PKCE S256."""
    verifier = secrets.token_urlsafe(64)[:128]
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
    return verifier, challenge
