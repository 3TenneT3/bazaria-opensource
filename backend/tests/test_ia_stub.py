"""Con la IA apagada, analizar-foto no debe contar usos."""
import io

import pytest
from PIL import Image
from sqlalchemy import func, select

from app.core.db import AsyncSessionLocal
from app.models.models import UsoIaDiario

pytestmark = pytest.mark.asyncio(loop_scope="session")


def _jpeg() -> bytes:
    b = io.BytesIO()
    Image.new("RGB", (20, 20), (200, 40, 80)).save(b, "JPEG")
    return b.getvalue()


async def test_ia_apagada_no_cuenta(client, usuaria_a):
    for _ in range(3):
        r = await client.post(
            "/ia/analizar-foto", files={"foto": ("f.jpg", _jpeg(), "image/jpeg")}, headers=usuaria_a["headers"]
        )
        assert r.status_code == 200
        assert r.json()["confianza"] == 0
    async with AsyncSessionLocal() as db:
        n = (await db.execute(select(func.count()).select_from(UsoIaDiario))).scalar_one()
    assert n == 0
