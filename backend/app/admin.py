"""Panel de administración de Bazaria (/admin), montado en el mismo FastAPI.

Usa SQLAdmin (SQLAlchemy Admin para Starlette/FastAPI). Login PROPIO de
administrador (usuario/contraseña en .env, variables ADMIN_USERNAME /
ADMIN_PASSWORD), completamente separado del login con Google + JWT de las
usuarias: un token de usuaria NUNCA sirve aquí, y la sesión de admin
(cookie firmada con ADMIN_SECRET_KEY) nunca sirve para llamar a los
endpoints de negocio (/lotes, /prendas, etc. siguen exigiendo su propio
JWT vía usuaria_actual).

Pensado para uso de administración de sistemas: ver/buscar usuarias,
lotes, prendas, ventas y fotos; forzar soft-delete/reactivar una cuenta
sin entrar por terminal.
"""
from __future__ import annotations

import secrets
import time
from collections import defaultdict, deque

from datetime import datetime, timedelta, timezone

from sqladmin import Admin, BaseView, ModelView, expose
from sqlalchemy import select
from sqladmin.authentication import AuthenticationBackend
from starlette.requests import Request
from starlette.responses import RedirectResponse

from app.core.config import get_settings
from app.core import contrasenas
from app.core.db import AsyncSessionLocal, engine
from app.models.models import AdminCuenta, Foto, Lote, Prenda, UsoIa, Usuaria, UsoIaDiario, Venta


ROL_ADMIN = "admin"
ROL_LECTOR = "lector"  # colaborador: ve todo, no puede crear, editar ni borrar

MAX_FALLOS = 5
VENTANA_S = 15 * 60


class IntentosLogin:
    """Bloquea una IP tras MAX_FALLOS intentos fallidos en VENTANA_S segundos.

    Memoria del proceso: con varios workers de uvicorn cada uno cuenta por su lado (el tope real
    se multiplica por el número de workers). Si se escala, mover a Postgres o a Caddy/Cloudflare.
    """

    def __init__(self, max_fallos: int = MAX_FALLOS, ventana_s: int = VENTANA_S) -> None:
        self.max_fallos = max_fallos
        self.ventana_s = ventana_s
        self._fallos: dict[str, deque[float]] = defaultdict(deque)

    def _limpiar(self, ip: str, ahora: float) -> deque[float]:
        q = self._fallos[ip]
        while q and ahora - q[0] > self.ventana_s:
            q.popleft()
        return q

    def bloqueada(self, ip: str, ahora: float | None = None) -> bool:
        return len(self._limpiar(ip, ahora or time.monotonic())) >= self.max_fallos

    def fallo(self, ip: str, ahora: float | None = None) -> None:
        ahora = ahora or time.monotonic()
        self._limpiar(ip, ahora).append(ahora)

    def exito(self, ip: str) -> None:
        self._fallos.pop(ip, None)


intentos_login = IntentosLogin()


def _ip(request: Request) -> str:
    # Detrás de Caddy la IP real llega en X-Forwarded-For (primer valor).
    reenviada = request.headers.get("x-forwarded-for", "")
    return reenviada.split(",")[0].strip() or (request.client.host if request.client else "desconocida")


def credenciales_validas(usuario: str, contrasena: str, esperado_usuario: str, esperada_contrasena: str) -> bool:
    """Compara en tiempo constante (y evalúa ambas, para no filtrar cuál falló)."""
    ok_usuario = secrets.compare_digest(usuario.encode(), esperado_usuario.encode())
    ok_contrasena = secrets.compare_digest(contrasena.encode(), esperada_contrasena.encode())
    return ok_usuario and ok_contrasena


def cuentas_configuradas() -> dict[str, tuple[str, str]]:
    """usuario -> (rol, contraseña inicial del .env)."""
    s = get_settings()
    cuentas = {s.admin_username: (ROL_ADMIN, s.admin_password)}
    if s.admin_lector_username:
        cuentas[s.admin_lector_username] = (ROL_LECTOR, s.admin_lector_password)
    return cuentas


async def validar_login(usuario: str, contrasena: str) -> str | None:
    """Devuelve el rol si las credenciales son correctas.

    La contraseña cambiada desde el panel (admin_cuentas) manda; la del .env solo vale
    mientras la cuenta no tenga una propia.
    """
    cuentas = cuentas_configuradas()
    # Comparar contra todas las cuentas (no cortar en la primera) para no filtrar cuál existe.
    rol_encontrado = None
    async with AsyncSessionLocal() as db:
        guardadas = {c.usuario: c for c in (await db.execute(select(AdminCuenta))).scalars()}
    for nombre, (rol, inicial) in cuentas.items():
        ok_usuario = secrets.compare_digest(usuario.encode(), nombre.encode())
        fila = guardadas.get(nombre)
        if fila and fila.password_hash:
            ok_pass = contrasenas.verificar(contrasena, fila.password_hash)
        else:
            ok_pass = secrets.compare_digest(contrasena.encode(), inicial.encode())
        if ok_usuario and ok_pass:
            rol_encontrado = rol
    return rol_encontrado


async def guardar_contrasena(usuario: str, nueva: str) -> None:
    async with AsyncSessionLocal() as db:
        fila = await db.get(AdminCuenta, usuario)
        if fila is None:
            fila = AdminCuenta(usuario=usuario)
            db.add(fila)
        fila.password_hash = contrasenas.hashear(nueva)
        fila.token_hash = None
        fila.token_expira = None
        await db.commit()


async def crear_enlace(usuario: str, minutos: int = 15) -> str:
    """Token de un solo uso para fijar contraseña sin saber la actual. Devuelve el token."""
    if usuario not in cuentas_configuradas():
        raise ValueError(f"No existe la cuenta del panel '{usuario}'")
    token = secrets.token_urlsafe(32)
    async with AsyncSessionLocal() as db:
        fila = await db.get(AdminCuenta, usuario)
        if fila is None:
            fila = AdminCuenta(usuario=usuario)
            db.add(fila)
        fila.token_hash = contrasenas.hash_token(token)
        fila.token_expira = datetime.now(timezone.utc) + timedelta(minutes=minutos)
        await db.commit()
    return token


async def usuario_del_enlace(token: str) -> str | None:
    if not token:
        return None
    h = contrasenas.hash_token(token)
    async with AsyncSessionLocal() as db:
        fila = (await db.execute(select(AdminCuenta).where(AdminCuenta.token_hash == h))).scalar_one_or_none()
    if fila is None or fila.token_expira is None or fila.token_expira < datetime.now(timezone.utc):
        return None
    return fila.usuario


class AdminAuth(AuthenticationBackend):
    """Backend de auth de SQLAdmin: usuario/contraseña fijos en .env.

    No usa la tabla `usuarias` ni Google OAuth — es una cuenta de
    administración de sistemas separada, pensada para Joseph/equipo, no
    para clientas de Bazaria.
    """

    async def login(self, request: Request) -> bool:
        ip = _ip(request)
        if intentos_login.bloqueada(ip):
            return False  # ni siquiera se revisa la contraseña mientras dure el bloqueo
        form = await request.form()
        settings = get_settings()
        username = str(form.get("username") or "")
        password = str(form.get("password") or "")
        rol = await validar_login(username, password)
        if rol:
            intentos_login.exito(ip)
            request.session.update({"admin_autenticado": True, "admin_rol": rol, "admin_usuario": username})
            return True
        intentos_login.fallo(ip)
        return False

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool | RedirectResponse:
        return bool(request.session.get("admin_autenticado"))


class VistaBase(ModelView):
    """El lector no ve botones de editar, borrar ni exportar.

    SQLAdmin decide los botones con atributos de clase; aquí se leen de la
    sesión de cada petición. La protección real está en SoloLecturaAdminMiddleware.
    """

    can_export = True

    def is_accessible(self, request: Request) -> bool:
        lector = request.session.get("admin_rol") == ROL_LECTOR
        # Los atributos se fijan por petición; el middleware evita que importe la carrera.
        self.can_edit = self._puede_editar and not lector
        self.can_delete = self._puede_borrar and not lector
        self.can_create = self._puede_crear and not lector
        self.can_export = not lector
        return True

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        cls._puede_editar = cls.__dict__.get("can_edit", True)
        cls._puede_borrar = cls.__dict__.get("can_delete", True)
        cls._puede_crear = cls.__dict__.get("can_create", True)


class UsuariaAdmin(VistaBase, model=Usuaria):
    name = "Usuaria"
    name_plural = "Usuarias"
    icon = "fa-solid fa-user"
    column_list = [
        Usuaria.id,
        Usuaria.email,
        Usuaria.nombre,
        Usuaria.plan,
        Usuaria.creada_en,
        Usuaria.eliminada_en,
    ]
    column_searchable_list = [Usuaria.email, Usuaria.nombre]
    column_sortable_list = [Usuaria.creada_en, Usuaria.eliminada_en]
    column_details_exclude_list = [Usuaria.google_sub]  # no exponer el sub de Google en la UI
    can_create = False  # las usuarias se crean solo vía login con Google
    can_delete = False  # el borrado real es soft-delete + scripts/purgar_usuarias.py
    form_columns = [Usuaria.email, Usuaria.nombre, Usuaria.plan, Usuaria.eliminada_en, Usuaria.version_sesion]
    form_choices = {"plan": [("gratis", "Gratis"), ("premium", "Premium")]}
    # Si una usuaria pierde el teléfono: sumar 1 aquí cierra TODAS sus sesiones abiertas.
    column_labels = {Usuaria.version_sesion: "Versión de sesión (+1 = cerrar todas sus sesiones)"}
    column_default_sort = [(Usuaria.creada_en, True)]


class LoteAdmin(VistaBase, model=Lote):
    name = "Lote"
    name_plural = "Lotes"
    icon = "fa-solid fa-box"
    column_list = [
        Lote.id,
        Lote.usuaria_id,
        Lote.nombre,
        Lote.costo_total,
        Lote.piezas_compradas,
        Lote.piezas_descartadas,
        Lote.fecha_compra,
    ]
    column_searchable_list = [Lote.nombre]
    column_sortable_list = [Lote.fecha_compra, Lote.creado_en]
    can_create = False
    can_edit = False
    can_delete = False
    column_default_sort = [(Lote.creado_en, True)]


class PrendaAdmin(VistaBase, model=Prenda):
    name = "Prenda"
    name_plural = "Prendas"
    icon = "fa-solid fa-shirt"
    column_list = [
        Prenda.id,
        Prenda.usuaria_id,
        Prenda.lote_id,
        Prenda.tipo,
        Prenda.estado,
        Prenda.costo,
        Prenda.precio_venta,
        Prenda.status,
        Prenda.creada_en,
    ]
    column_searchable_list = [Prenda.tipo, Prenda.color, Prenda.marca]
    column_sortable_list = [Prenda.creada_en, Prenda.status]
    can_create = False
    can_edit = False
    can_delete = False
    column_default_sort = [(Prenda.creada_en, True)]


class VentaAdmin(VistaBase, model=Venta):
    name = "Venta"
    name_plural = "Ventas"
    icon = "fa-solid fa-cash-register"
    column_list = [
        Venta.id,
        Venta.usuaria_id,
        Venta.prenda_id,
        Venta.precio_final,
        Venta.costo_envio,
        Venta.comision,
        Venta.canal,
        Venta.fecha_venta,
        Venta.reembolso,
        Venta.destino_devolucion,
        Venta.devuelta_en,
    ]
    column_sortable_list = [Venta.fecha_venta]
    can_create = False
    can_edit = False
    can_delete = False
    column_default_sort = [(Venta.fecha_venta, True)]


class FotoAdmin(VistaBase, model=Foto):
    name = "Foto"
    name_plural = "Fotos"
    icon = "fa-solid fa-image"
    column_list = [Foto.id, Foto.usuaria_id, Foto.sha256, Foto.llave, Foto.bytes_, Foto.creada_en]
    column_searchable_list = [Foto.sha256]
    can_create = False
    can_edit = False
    can_delete = False
    column_default_sort = [(Foto.creada_en, True)]


class UsoIaAdmin(VistaBase, model=UsoIa):
    """Llamadas reales a modelos de IA, con su costo. Vacía mientras no haya IA conectada."""

    name = "Uso de IA"
    name_plural = "Uso de IA (costo real)"
    icon = "fa-solid fa-robot"
    column_list = [
        UsoIa.creado_en,
        UsoIa.usuaria_id,
        UsoIa.funcion,
        UsoIa.modelo,
        UsoIa.tokens_entrada,
        UsoIa.tokens_salida,
        UsoIa.costo_centavos,
    ]
    column_default_sort = [(UsoIa.creado_en, True)]
    can_create = False
    can_edit = False
    can_delete = False


class UsoIaDiarioAdmin(VistaBase, model=UsoIaDiario):
    name = "Contador viejo (fotos, no IA)"
    name_plural = "Contador viejo (fotos, no IA)"
    icon = "fa-solid fa-robot"
    column_list = [UsoIaDiario.id, UsoIaDiario.usuaria_id, UsoIaDiario.fecha, UsoIaDiario.contador]
    can_create = False
    can_edit = False
    can_delete = False


class UsoPorUsuariaAdmin(BaseView):
    """Fotos, espacio y artículos por usuaria, para medir capacidad y costo promedio."""

    name = "Uso por usuaria"
    icon = "fa-solid fa-chart-column"

    @expose("/uso-por-usuaria", methods=["GET"])
    async def uso(self, request: Request):
        from sqlalchemy import text

        consulta = text(
            """
            select u.email, u.plan, u.creada_en,
                   (select count(*) from prendas p where p.usuaria_id = u.id) as articulos,
                   (select count(*) from fotos f where f.usuaria_id = u.id) as fotos,
                   (select coalesce(sum(f.bytes), 0) from fotos f where f.usuaria_id = u.id) as bytes,
                   (select count(*) from uso_ia i where i.usuaria_id = u.id
                      and i.creado_en >= date_trunc('month', now())) as ia_mes,
                   (select coalesce(sum(i.costo_centavos), 0) from uso_ia i where i.usuaria_id = u.id
                      and i.creado_en >= date_trunc('month', now())) as ia_costo_mes
            from usuarias u
            where u.eliminada_en is null
            order by bytes desc
            """
        )
        async with AsyncSessionLocal() as db:
            filas = [dict(r._mapping) for r in (await db.execute(consulta))]
        n = len(filas) or 1
        totales = {
            "usuarias": len(filas),
            "articulos": sum(f["articulos"] for f in filas),
            "fotos": sum(f["fotos"] for f in filas),
            "mb": sum(f["bytes"] for f in filas) / 1_048_576,
            "ia_costo_mes": sum(f["ia_costo_mes"] for f in filas) / 100,
        }
        totales["mb_promedio"] = totales["mb"] / n
        totales["fotos_promedio"] = totales["fotos"] / n
        return await self.templates.TemplateResponse(
            request, "uso_por_usuaria.html", {"filas": filas, "t": totales}
        )


class MiCuentaAdmin(BaseView):
    """Cambiar la contraseña propia desde el panel (admin y lector)."""

    name = "Cambiar mi contraseña"
    icon = "fa-solid fa-key"

    @expose("/mi-cuenta", methods=["GET", "POST"])
    async def mi_cuenta(self, request: Request):
        usuario = request.session.get("admin_usuario", "")
        mensaje, error = None, None
        if request.method == "POST":
            form = await request.form()
            actual = str(form.get("actual") or "")
            nueva = str(form.get("nueva") or "")
            repetida = str(form.get("repetida") or "")
            ip = _ip(request)
            if intentos_login.bloqueada(ip):
                error = "Demasiados intentos. Espera 15 minutos."
            elif await validar_login(usuario, actual) is None:
                intentos_login.fallo(ip)
                error = "La contraseña actual no es correcta."
            elif (p := contrasenas.problema(nueva, repetida)) is not None:
                error = p
            else:
                await guardar_contrasena(usuario, nueva)
                mensaje = "Listo: tu contraseña cambió. Úsala la próxima vez que entres."
        return await self.templates.TemplateResponse(
            request, "mi_cuenta.html", {"usuario": usuario, "mensaje": mensaje, "error": error}
        )


_METODOS_LECTURA = {"GET", "HEAD", "OPTIONS"}
# /export cuenta como escritura: el lector ve en pantalla, pero no se lleva la base completa.
_RUTAS_ESCRITURA = ("/edit/", "/create", "/delete", "/export")
# Rutas del panel que el lector SÍ puede usar con POST (son sobre su propia cuenta).
_POST_PERMITIDOS = ("/admin/login", "/admin/logout", "/admin/mi-cuenta", "/admin/fijar-contrasena")


def es_escritura_admin(metodo: str, ruta: str) -> bool:
    """¿Esta petición al panel cambia (o abre un formulario para cambiar) datos?"""
    if ruta in _POST_PERMITIDOS:
        return False
    if metodo.upper() not in _METODOS_LECTURA:
        return True
    return any(seg in ruta for seg in _RUTAS_ESCRITURA)


class SoloLecturaAdminMiddleware:
    """Con rol lector, rechaza (403) toda escritura en /admin y /flare.

    Se aplica en el servidor, no solo escondiendo botones: aunque alguien arme
    la petición a mano, no pasa. Debe ir DENTRO de SessionMiddleware para poder
    leer scope["session"].
    """

    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] == "http":
            ruta = scope["path"]
            if ruta.startswith(("/admin", "/flare")):
                sesion = scope.get("session") or {}
                es_lector = sesion.get("admin_rol") == ROL_LECTOR
                # /flare guarda URLs completas (incluido el enlace de un solo uso para fijar la
                # contraseña del panel): un lector podría tomar la cuenta de admin. No entra.
                if es_lector and (ruta.startswith("/flare") or es_escritura_admin(scope["method"], ruta)):
                    from starlette.responses import PlainTextResponse

                    resp = PlainTextResponse("Tu cuenta es de solo lectura.", status_code=403)
                    await resp(scope, receive, send)
                    return
        await self.app(scope, receive, send)


def registrar_admin(app) -> None:
    settings = get_settings()
    auth_backend = AdminAuth(secret_key=settings.admin_secret_key)
    # SQLAdmin monta su propio SessionMiddleware, que mandaba una segunda cookie "session". La app
    # ya tiene uno (main.py: Secure, 8 h, SameSite=lax) que cubre /admin: se usa solo ese.
    auth_backend.middlewares = []
    import pathlib

    # Antes de montar SQLAdmin: el mount de /admin se tragaría esta ruta si va después.
    app.include_router(router_fijar)
    plantillas = str(pathlib.Path(__file__).parent / "templates")
    admin = Admin(
        app, engine, authentication_backend=auth_backend, title="Bazaria — Admin", templates_dir=plantillas,
        favicon_url="/favicon.svg"
    )
    admin.add_view(UsuariaAdmin)
    admin.add_view(LoteAdmin)
    admin.add_view(PrendaAdmin)
    admin.add_view(VentaAdmin)
    admin.add_view(FotoAdmin)
    admin.add_view(UsoIaAdmin)
    admin.add_view(UsoIaDiarioAdmin)
    admin.add_base_view(UsoPorUsuariaAdmin)
    admin.add_base_view(MiCuentaAdmin)


# --- Enlace de un solo uso para fijar contraseña (sin sesión, sin SSH) ---
# Lo genera scripts/enlace_contrasena_admin.py en el servidor. Vive fuera de SQLAdmin
# porque SQLAdmin exige sesión iniciada en todas sus rutas.
from fastapi import APIRouter, Form  # noqa: E402
from fastapi.responses import HTMLResponse  # noqa: E402
from html import escape  # noqa: E402

router_fijar = APIRouter(include_in_schema=False)


def _pagina(cuerpo: str, codigo: int = 200) -> HTMLResponse:
    return HTMLResponse(
        f"""<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Bazaria — Contraseña del panel</title>
<style>body{{font-family:system-ui,sans-serif;background:#f5f3fb;margin:0;padding:24px;color:#1b1630}}
main{{max-width:420px;margin:40px auto;background:#fff;border-radius:16px;padding:24px;box-shadow:0 4px 20px #0001}}
label{{display:block;font-size:14px;font-weight:600;margin:14px 0 6px}}
input{{width:100%;box-sizing:border-box;padding:12px;border:1px solid #ccc;border-radius:10px;font-size:16px}}
button,a.btn{{display:block;width:100%;margin-top:18px;padding:13px;border:0;border-radius:12px;background:#7c5cd6;
color:#fff;font-size:16px;font-weight:600;text-align:center;text-decoration:none}}
.err{{background:#fde8ee;color:#8a1c3a;padding:10px;border-radius:10px}}</style></head>
<body><main>{cuerpo}</main></body></html>""",
        status_code=codigo,
        headers={"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"},
    )


def _formulario(token: str, usuario: str, error: str | None = None) -> HTMLResponse:
    err = f'<p class="err">{escape(error)}</p>' if error else ""
    return _pagina(
        f"""<h1>Pon tu contraseña</h1><p>Cuenta del panel: <strong>{escape(usuario)}</strong></p>{err}
<form method="post"><input type="hidden" name="token" value="{escape(token)}">
<label>Contraseña nueva (mínimo {contrasenas.MINIMO} caracteres)</label>
<input type="password" name="nueva" required minlength="{contrasenas.MINIMO}" autocomplete="new-password">
<label>Repítela</label>
<input type="password" name="repetida" required minlength="{contrasenas.MINIMO}" autocomplete="new-password">
<button type="submit">Guardar contraseña</button></form>"""
    )


_INVALIDO = "<h1>Enlace no válido</h1><p>Este enlace ya se usó o caducó. Pide uno nuevo.</p>"


@router_fijar.get("/admin/fijar-contrasena")
async def fijar_contrasena_form(token: str = ""):
    usuario = await usuario_del_enlace(token)
    if usuario is None:
        return _pagina(_INVALIDO, 410)
    return _formulario(token, usuario)


@router_fijar.post("/admin/fijar-contrasena")
async def fijar_contrasena(
    request: Request, token: str = Form(""), nueva: str = Form(""), repetida: str = Form("")
):
    ip = _ip(request)
    if intentos_login.bloqueada(ip):
        return _pagina("<h1>Espera un momento</h1><p>Demasiados intentos. Prueba en 15 minutos.</p>", 429)
    usuario = await usuario_del_enlace(token)
    if usuario is None:
        intentos_login.fallo(ip)
        return _pagina(_INVALIDO, 410)
    if (p := contrasenas.problema(nueva, repetida)) is not None:
        return _formulario(token, usuario, p)
    await guardar_contrasena(usuario, nueva)  # también invalida el enlace
    return _pagina(
        f"""<h1>¡Listo!</h1><p>La contraseña de <strong>{escape(usuario)}</strong> quedó guardada.
Este enlace ya no sirve.</p><a class="btn" href="/admin/login">Entrar al panel</a>"""
    )
