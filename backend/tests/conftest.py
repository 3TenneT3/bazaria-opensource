from __future__ import annotations

import asyncio
import os
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine

from urllib.parse import urlsplit

# SEGURIDAD: _crear_esquema hace DROP de todas las tablas. Si la terminal tiene cargado el .env
# de producción (pasó el 16 oct 2026), un setdefault dejaría DATABASE_URL apuntando a producción.
# Por eso todo se FUERZA aquí y se aborta si la base no es claramente de pruebas.
_URL_PRUEBAS = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+asyncpg://bazaria:bazaria@localhost:5434/bazaria_test"
)
_destino = urlsplit(_URL_PRUEBAS.replace("+asyncpg", ""))
if not _destino.path.rstrip("/").endswith("_test") or _destino.hostname not in ("localhost", "127.0.0.1"):
    pytest.exit(
        f"Base de pruebas no segura: {_destino.hostname}{_destino.path}. "
        "Debe ser localhost y su nombre terminar en _test (usa TEST_DATABASE_URL).",
        returncode=2,
    )
os.environ["DATABASE_URL"] = _URL_PRUEBAS
os.environ["JWT_SECRET"] = "test-secret"
os.environ["FOTOS_DIR"] = "/tmp/bazaria-test-fotos"  # nunca la carpeta real de fotos
os.environ["FOTOS_BASE_URL"] = "http://localhost:8100/fotos"
os.environ["FRONTEND_URL"] = "http://localhost:5173"
os.environ["ADMIN_SECRET_KEY"] = "test-admin-secret-key"
os.environ["FLARE_SQLITE_PATH"] = "/tmp/bazaria-test-flare.sqlite3"
# Forzado (no setdefault): el backend/.env real trae ADMIN_HOST y el host de pruebas es "test".
os.environ["ADMIN_HOST"] = ""
# Cuentas del panel para tests (forzadas: no deben salir del backend/.env real).
os.environ["ADMIN_USERNAME"] = "admin-test"
os.environ["ADMIN_PASSWORD"] = "admin-test-password"
os.environ["ADMIN_LECTOR_USERNAME"] = "sebas-test"
os.environ["ADMIN_LECTOR_PASSWORD"] = "lector-test-password-123"
os.environ["COOKIE_SECURE"] = "false"

from app.core.config import get_settings  # noqa: E402
from app.core.db import Base, engine  # noqa: E402
from app.core.security import crear_jwt  # noqa: E402
from app.main import app  # noqa: E402
from app.models.models import Usuaria  # noqa: E402
from app.core.db import AsyncSessionLocal  # noqa: E402


@pytest_asyncio.fixture(autouse=True, scope="session")
async def _crear_esquema():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()
    # fastapi-flare abre una conexión aiosqlite (hilo no-daemon). En tests
    # ASGITransport no ejecuta el lifespan que la cerraría, y pytest se
    # queda colgado al salir. Se cierra aquí explícitamente.
    for mw in app.user_middleware:
        cfg = mw.kwargs.get("config") if hasattr(mw, "kwargs") else None
        if cfg is not None and getattr(cfg, "storage_instance", None) is not None:
            await cfg.storage_instance.close()
            break


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def _crear_usuaria(email: str) -> tuple[str, str]:
    async with AsyncSessionLocal() as session:
        usuaria = Usuaria(google_sub=f"sub-{uuid.uuid4()}", email=email, nombre="Test")
        session.add(usuaria)
        await session.commit()
        await session.refresh(usuaria)
        return usuaria.id, crear_jwt(usuaria.id, usuaria.version_sesion)


@pytest_asyncio.fixture
async def usuaria_a():
    uid, token = await _crear_usuaria("usuaria.a@example.com")
    return {"id": uid, "token": token, "headers": {"Authorization": f"Bearer {token}"}}


@pytest_asyncio.fixture
async def usuaria_b():
    uid, token = await _crear_usuaria("usuaria.b@example.com")
    return {"id": uid, "token": token, "headers": {"Authorization": f"Bearer {token}"}}
