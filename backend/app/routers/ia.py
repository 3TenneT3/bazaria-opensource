from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_db
from app.core.deps import usuaria_actual
from app.core.errors import ApiError
from app.models.models import UsoIa, Usuaria
from app.schemas import AnalisisFotoOut

router = APIRouter(prefix="/ia", tags=["ia"])

_VACIO = AnalisisFotoOut(tipo=None, color=None, talla=None, marca=None, estado=None, confianza=0.0)


@router.post("/analizar-foto", response_model=AnalisisFotoOut)
async def analizar_foto(
    foto: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    usuaria: Usuaria = Depends(usuaria_actual),
):
    """Reconocer una prenda por foto. Solo para el plan premium y con IA conectada.

    Hoy no hay modelo conectado (IA_ACTIVA=false): responde vacío sin contar nada.
    Cuando se conecte, cada llamada real se registra en uso_ia con su costo.
    """
    settings = get_settings()
    if not settings.ia_activa or usuaria.plan != "premium":
        return _VACIO

    hoy = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    usadas = (
        await db.execute(
            select(func.count()).select_from(UsoIa).where(UsoIa.usuaria_id == usuaria.id, UsoIa.creado_en >= hoy)
        )
    ).scalar_one()
    if usadas >= settings.ia_limite_diario:
        raise ApiError(429, "LIMITE_DIARIO_IA", "Llegaste al límite de análisis de hoy, captura manual")

    # Punto de conexión del modelo: aquí va la llamada real al proveedor, y después
    # db.add(UsoIa(usuaria_id=..., funcion="analizar_foto", modelo=..., tokens_entrada=...,
    #              tokens_salida=..., costo_centavos=...)) con lo que reporte el proveedor.
    # Mientras no exista, no se registra un costo inventado.
    return _VACIO
