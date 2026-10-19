from __future__ import annotations

import pathlib

import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.middleware.sessions import SessionMiddleware
from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.config import get_settings
from app.core.errors import ApiError
from app.routers import auth, ia, lotes, prendas, reportes, ventas
from app.admin import SoloLecturaAdminMiddleware, registrar_admin

settings = get_settings()

app = FastAPI(
    title="Bazaria API",
    docs_url="/docs" if settings.exponer_docs else None,
    redoc_url="/redoc" if settings.exponer_docs else None,
    openapi_url="/openapi.json" if settings.exponer_docs else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    # La app manda la sesión en Authorization (no cookies): sin credenciales y solo lo que usa.
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

# SessionMiddleware: lo requiere SQLAdmin para la cookie de sesión del
# panel (/admin). Firmada con ADMIN_SECRET_KEY, NO con JWT_SECRET — son
# secretos distintos a propósito, para que una fuga de uno no comprometa
# al otro.
# Va ANTES de SessionMiddleware en el código para quedar DENTRO de ella
# (Starlette: el último add_middleware es el más externo) y leer la sesión.
app.add_middleware(SoloLecturaAdminMiddleware)
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.admin_secret_key,
    https_only=settings.cookie_secure,  # la cookie del panel nunca viaja por http
    max_age=8 * 3600,  # una jornada; antes duraba 14 días
    same_site="lax",
)


class PanelSoloEnSuDominioMiddleware:
    """El panel (/admin, /flare) solo existe en ADMIN_HOST; en cualquier otro dominio, 404.

    La misma app atiende api.example.com y admin.example.com: sin esto el panel también
    quedaba publicado en el dominio de la API.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        esperado = get_settings().admin_host.strip().lower()
        if esperado and scope["type"] == "http" and scope["path"].startswith(("/admin", "/flare")):
            host = dict(scope.get("headers") or []).get(b"host", b"").decode("latin-1").split(":")[0].lower()
            if host != esperado:
                resp = JSONResponse(status_code=404, content={"error": {"codigo": "NO_ENCONTRADO", "mensaje": "No encontrado"}})
                await resp(scope, receive, send)
                return
        await self.app(scope, receive, send)


app.add_middleware(PanelSoloEnSuDominioMiddleware)


class FotosCacheHeaderMiddleware:
    """Agrega Cache-Control agresivo a /fotos/* (nombre por contenido => inmutable).

    Desviación de la spec: backend-spec.md sugiere que Caddy sirva /fotos
    directo del disco. Aquí FastAPI las sirve (ver README, sección
    'Desviaciones') porque el Caddy compartido de la VPS no monta fácilmente
    el volumen de fotos sin tocar su propio compose.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or not scope["path"].startswith("/fotos/"):
            await self.app(scope, receive, send)
            return

        async def send_wrapper(message):
            # Solo las fotos servidas (200) se cachean; un 403/404 no debe quedarse 7 días.
            if message["type"] == "http.response.start" and message.get("status") == 200:
                headers = list(message.get("headers", []))
                # private: el contenido no cambia (nombre = hash), pero el acceso es por
                # enlace firmado; Cloudflare no debe guardar una copia pública.
                headers.append((b"cache-control", b"private, max-age=604800, immutable"))
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_wrapper)


app.add_middleware(FotosCacheHeaderMiddleware)

os.makedirs(settings.fotos_dir, exist_ok=True)


@app.get("/fotos/{llave:path}", include_in_schema=False)
async def servir_foto(llave: str, e: str = "", s: str = ""):
    """Sirve una foto solo con enlace firmado y vigente (ver domain/fotos.enlace_valido)."""
    from fastapi.responses import FileResponse

    from app.domain.fotos import enlace_valido

    if not enlace_valido(llave, e, s):
        raise ApiError(403, "ENLACE_INVALIDO", "Enlace de foto no válido o caducado")
    ruta = os.path.join(settings.fotos_dir, llave)
    if not os.path.isfile(ruta):
        raise ApiError(404, "NO_ENCONTRADO", "Foto no encontrada")
    return FileResponse(ruta, media_type="image/webp")


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    # Captura manual en fastapi-flare: solo para 5xx (los 4xx de negocio,
    # como 404/409/422, no son "errores del sistema" que ameriten entrar
    # al dashboard de /flare). Ver nota junto a app.add_exception_handler
    # más abajo sobre por qué esto reemplaza el handler que instala
    # fastapi_flare.setup() en vez de dejarlo competir con el nuestro.
    if exc.status_code >= 500:
        try:
            from fastapi_flare import capture_message

            capture_message(str(exc.detail), level="ERROR", event="http_exception")
        except Exception:  # noqa: BLE001 — nunca romper la respuesta real por un fallo de logging
            pass

    detail = exc.detail
    if isinstance(detail, dict) and "codigo" in detail:
        return JSONResponse(status_code=exc.status_code, content={"error": detail})
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"codigo": "ERROR", "mensaje": str(detail)}},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"error": {"codigo": "VALIDACION", "mensaje": str(exc.errors())}},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Excepciones no controladas (bugs reales, 500): SÍ se capturan siempre
    # en /flare -- es justo el caso de uso principal del panel.
    try:
        from fastapi_flare import capture_exception

        capture_exception(exc, event="unhandled_exception")
    except Exception:  # noqa: BLE001
        pass

    return JSONResponse(
        status_code=500,
        content={"error": {"codigo": "ERROR_INTERNO", "mensaje": "Error interno del servidor"}},
    )


@app.get("/health")
async def health():
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(lotes.router)
app.include_router(prendas.router)
app.include_router(ventas.router)
app.include_router(reportes.router)
app.include_router(ia.router)

# --- Panel de administración de sistemas (admin.example.com) ---
# /admin: SQLAdmin (ver/buscar usuarias, lotes, prendas, ventas, fotos;
#         forzar soft-delete/reactivar sin entrar por terminal).
# /flare: fastapi-flare (errores 5xx capturados automáticamente, dashboard
#         propio, sin servicio externo). Ambos con login PROPIO de
#         administrador (ADMIN_USERNAME/ADMIN_PASSWORD en .env), separado
#         del JWT de las usuarias.
from fastapi_flare import FlareConfig, setup as setup_flare  # noqa: E402


def _verificar_admin_flare(request: Request) -> None:
    # Una dependencia de FastAPI NO bloquea por devolver False: hay que
    # lanzar. (Bug previo: devolvía bool y /flare quedaba público.)
    if not request.session.get("admin_autenticado"):
        raise HTTPException(status_code=401, detail="Inicia sesión en /admin primero")


# Favicon del panel (admin/flare). Mismo icono que la app web; servido por el
# backend porque admin.example.com no pasa por el frontend.
_FAVICON = pathlib.Path(__file__).parent / "static" / "favicon.svg"


@app.get("/favicon.svg", include_in_schema=False)
@app.get("/favicon.ico", include_in_schema=False)
async def favicon() -> FileResponse:
    return FileResponse(_FAVICON, media_type="image/svg+xml", headers={"Cache-Control": "public, max-age=86400"})


registrar_admin(app)
setup_flare(
    app,
    config=FlareConfig(
        dashboard_path="/flare",
        dashboard_auth_dependency=_verificar_admin_flare,
        # Storage SQLite dedicado (zero-config, no toca el Postgres de
        # producción): solo errores/requests capturados para diagnóstico,
        # no es dato de negocio que necesite ir en el mismo respaldo.
        # En volumen (docker-compose: ./data/flare:/data/flare) para que el
        # histórico sobreviva a cada `up --build`. Configurable por env en tests.
        sqlite_path=os.environ.get("FLARE_SQLITE_PATH", "/data/flare/flare.sqlite3"),
        # Nunca guardar cuerpos: un error en /admin/login guardaría la contraseña, y en /prendas
        # datos de la usuaria. Ruta, código, IP y traza bastan para diagnosticar.
        max_request_body_bytes=0,
        capture_response_body=False,
        capture_request_headers=False,  # Authorization / cookies de sesión
        retention_hours=168,  # 7 días, como dice el aviso de privacidad
    ),
)

# fastapi_flare.setup() instala SUS PROPIOS exception handlers para
# HTTPException/RequestValidationError/Exception, y lo hace DESPUÉS de los
# nuestros — el último handler registrado gana. Sin este re-registro, TODO
# el contrato de error estándar de la API ({"error": {"codigo","mensaje"}})
# quedaría roto (volvería al {"detail": ...} default de FastAPI, violando
# api-contract.md). Nuestros handlers (arriba) YA hacen captura manual a
# flare (capture_message/capture_exception) para los casos que importan
# (5xx), así que no perdemos observabilidad al reemplazar los suyos.
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)
