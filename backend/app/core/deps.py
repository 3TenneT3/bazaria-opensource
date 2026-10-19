from __future__ import annotations

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.security import decodificar_jwt
from app.models.models import Usuaria


async def usuaria_actual(
    request: Request, db: AsyncSession = Depends(get_db)
) -> Usuaria:
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth or not auth.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="token faltante")

    token = auth.split(" ", 1)[1].strip()
    decodificado = decodificar_jwt(token)
    if not decodificado:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="token inválido")
    usuaria_id, version_sesion = decodificado

    result = await db.execute(select(Usuaria).where(Usuaria.id == usuaria_id))
    usuaria = result.scalar_one_or_none()
    if usuaria is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="usuaria no existe")
    if usuaria.eliminada_en is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="cuenta eliminada")
    if version_sesion != usuaria.version_sesion:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="sesión cerrada")

    return usuaria
