"""Cuotas de fotos por usuaria: espacio por plan y fotos nuevas por hora."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import ApiError
from app.models.models import Foto, Usuaria


def cuota_bytes(plan: str) -> int:
    s = get_settings()
    mb = s.cuota_fotos_mb_premium if plan == "premium" else s.cuota_fotos_mb_gratis
    return mb * 1024 * 1024


async def uso_fotos(db: AsyncSession, usuaria_id: str) -> int:
    total = await db.scalar(select(func.coalesce(func.sum(Foto.bytes_), 0)).where(Foto.usuaria_id == usuaria_id))
    return int(total or 0)


async def exigir_cuota_para_foto_nueva(db: AsyncSession, usuaria: Usuaria) -> None:
    """Lanza 413 si ya llenó su espacio y 429 si subió demasiadas fotos nuevas en la última hora.

    Se llama solo para fotos NUEVAS (antes de procesarlas con Pillow): una foto que la usuaria
    ya tiene se reutiliza y no gasta espacio ni cuenta para el límite por hora.
    """
    s = get_settings()
    hace_una_hora = datetime.now(timezone.utc) - timedelta(hours=1)
    recientes = await db.scalar(
        select(func.count()).select_from(Foto).where(Foto.usuaria_id == usuaria.id, Foto.creada_en > hace_una_hora)
    )
    if (recientes or 0) >= s.fotos_por_hora:
        raise ApiError(
            429,
            "LIMITE_SUBIDAS",
            f"Subiste más de {s.fotos_por_hora} fotos en la última hora. Las demás quedan guardadas "
            "en tu teléfono y se suben solas en un rato.",
        )
    limite = cuota_bytes(usuaria.plan)
    if await uso_fotos(db, usuaria.id) >= limite:
        raise ApiError(
            413,
            "CUOTA_FOTOS",
            f"Llegaste al límite de espacio para fotos de tu plan ({limite // (1024 * 1024)} MB). "
            "Borra prendas que ya no necesites o pásate a premium.",
        )
