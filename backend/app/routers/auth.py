from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from app.core.config import get_settings
from app.core.db import get_db
from app.core.deps import usuaria_actual
from app.core.errors import ApiError
from app.core.google_oauth import build_authorize_url, exchange_code_for_tokens, verificar_id_token
from app.core.security import crear_jwt, generar_pkce_pair, generar_state
from app.models.models import Usuaria
from app.schemas import MeOut

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger("bazaria.auth")

STATE_COOKIE = "bazaria_oauth_state"
VERIFIER_COOKIE = "bazaria_oauth_verifier"
STATE_MAX_AGE = 10 * 60  # 10 minutos


@router.get("/google")
async def auth_google(response: Response):
    settings = get_settings()
    state = generar_state()
    verifier, challenge = generar_pkce_pair()

    url = build_authorize_url(state, challenge)
    redirect = RedirectResponse(url=url, status_code=302)
    redirect.set_cookie(
        STATE_COOKIE,
        state,
        max_age=STATE_MAX_AGE,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
    )
    redirect.set_cookie(
        VERIFIER_COOKIE,
        verifier,
        max_age=STATE_MAX_AGE,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
    )
    return redirect


@router.get("/google/callback")
async def auth_google_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    settings = get_settings()
    cookie_state = request.cookies.get(STATE_COOKIE)
    cookie_verifier = request.cookies.get(VERIFIER_COOKIE)

    if not code or not state or not cookie_state or state != cookie_state or not cookie_verifier:
        logger.warning(
            "callback sin cookies/state validos: code=%s state=%s cookie_state=%s cookie_verifier=%s",
            bool(code), state, cookie_state, bool(cookie_verifier),
        )
        return RedirectResponse(url=f"{settings.frontend_url}/#error=acceso_denegado", status_code=302)

    try:
        tokens = await exchange_code_for_tokens(code, cookie_verifier)
        id_token = tokens["id_token"]
        claims = await verificar_id_token(id_token, access_token=tokens.get("access_token"))
    except Exception:
        logger.exception("fallo intercambio de codigo o verificacion de id_token")
        return RedirectResponse(url=f"{settings.frontend_url}/#error=acceso_denegado", status_code=302)

    email = claims.get("email", "").lower()
    if settings.allowed_emails_list and email not in settings.allowed_emails_list:
        return RedirectResponse(url=f"{settings.frontend_url}/#error=acceso_denegado", status_code=302)

    google_sub = claims["sub"]
    nombre = claims.get("name")

    result = await db.execute(select(Usuaria).where(Usuaria.google_sub == google_sub))
    usuaria = result.scalar_one_or_none()
    if usuaria is None:
        usuaria = Usuaria(google_sub=google_sub, email=email, nombre=nombre)
        db.add(usuaria)
    else:
        usuaria.email = email
        usuaria.nombre = nombre
        if usuaria.eliminada_en is not None:
            # Estaba en periodo de gracia (soft delete, aún no purgada):
            # si vuelve a entrar por su propia voluntad, se reactiva.
            logger.info("usuaria %s reactivada tras soft delete", usuaria.id)
            usuaria.eliminada_en = None
    await db.commit()
    await db.refresh(usuaria)

    jwt_token = crear_jwt(usuaria.id, usuaria.version_sesion)
    redirect = RedirectResponse(url=f"{settings.frontend_url}/#token={jwt_token}", status_code=302)
    redirect.delete_cookie(STATE_COOKIE)
    redirect.delete_cookie(VERIFIER_COOKIE)
    return redirect


@router.get("/me", response_model=MeOut)
async def auth_me(usuaria: Usuaria = Depends(usuaria_actual)):
    s = get_settings()
    return MeOut(email=usuaria.email, plan=usuaria.plan, ia_disponible=s.ia_activa and usuaria.plan == "premium")


@router.post("/cerrar-sesiones", status_code=204)
async def cerrar_sesiones(
    db: AsyncSession = Depends(get_db),
    usuaria: Usuaria = Depends(usuaria_actual),
):
    """Cierra la sesión en TODOS los dispositivos (incluido este): sube la versión de sesión y
    todos los tokens emitidos antes dejan de valer. Para cuando se pierde o se presta el teléfono."""
    usuaria.version_sesion += 1
    await db.commit()
    logger.info("usuaria %s cerró sesión en todos los dispositivos", usuaria.id)
    return None


@router.delete("/me", status_code=204)
async def eliminar_mi_cuenta(
    db: AsyncSession = Depends(get_db),
    usuaria: Usuaria = Depends(usuaria_actual),
):
    """Soft delete: marca la cuenta como eliminada, no borra nada todavía.

    - Acceso inmediato bloqueado (usuaria_actual rechaza con 401 en cuanto
      eliminada_en no es null).
    - Sus datos (lotes, prendas, ventas, fotos) NO se borran en este momento
      ni se filtran de ningún listado nuevo porque ya no puede autenticarse.
    - Un job de purga (scripts/purgar_usuarias.py, cron) borra DEFINITIVAMENTE
      (fila de usuarias -> cascada en DB + archivos de fotos en disco) pasado
      el periodo de gracia (ver RETENCION_DIAS en ese script).
    - Si la usuaria vuelve a iniciar sesión con Google ANTES de que se
      purgue, se reactiva automáticamente (ver auth_google_callback).
    """
    usuaria.eliminada_en = datetime.now(timezone.utc)
    await db.commit()
    return None
