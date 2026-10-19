from __future__ import annotations

from typing import Optional

from fastapi import HTTPException
from fastapi.responses import JSONResponse


class ApiError(HTTPException):
    def __init__(self, status_code: int, codigo: str, mensaje: str):
        super().__init__(status_code=status_code, detail={"codigo": codigo, "mensaje": mensaje})


def error_response(status_code: int, codigo: str, mensaje: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": {"codigo": codigo, "mensaje": mensaje}})


def fecha_cliente_o_none(valor):
    """Fecha enviada por el cliente: se acepta solo si no es futura (tolerancia de 5 min)."""
    from datetime import datetime, timedelta, timezone

    if valor is None:
        return None
    v = valor if valor.tzinfo else valor.replace(tzinfo=timezone.utc)
    return v if v <= datetime.now(timezone.utc) + timedelta(minutes=5) else None


def id_en_uso(mensaje: str = "Ese identificador ya existe") -> ApiError:
    return ApiError(409, "ID_EN_USO", mensaje)


def not_found(mensaje: str = "Recurso no encontrado") -> ApiError:
    return ApiError(404, "NO_ENCONTRADO", mensaje)


def validacion(mensaje: str) -> ApiError:
    return ApiError(422, "VALIDACION", mensaje)


# Ids (UUID) que llegan del cliente. Validarlos ANTES de la base: un id malformado en la URL o
# en el cuerpo daba 500 (asyncpg rechaza el valor como UUID); ahora es 422 de validación.
from typing import Annotated  # noqa: E402

from fastapi import Path  # noqa: E402
from pydantic import StringConstraints  # noqa: E402

PATRON_UUID = r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
IdUuid = Annotated[str, StringConstraints(pattern=PATRON_UUID)]  # en esquemas (cuerpo JSON)
IdRuta = Annotated[str, Path(pattern=PATRON_UUID)]  # en parámetros de la URL
