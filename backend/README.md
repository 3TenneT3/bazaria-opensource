# Backend de Bazaria

API en Python 3.12 + FastAPI + PostgreSQL 16 + SQLAlchemy 2 (async) + Alembic.
Implementa [docs/es/backend-spec.md](../docs/es/backend-spec.md) y el contrato
[docs/es/api-contract.md](../docs/es/api-contract.md).

## Stack

| Pieza | Versión / librería |
|---|---|
| Runtime | Python 3.12, uvicorn |
| Web | FastAPI 0.143 (Starlette 1.8) |
| Base de datos | PostgreSQL 16, SQLAlchemy 2 async + asyncpg |
| Migraciones | Alembic (`alembic/versions/`) |
| Auth | Google OAuth 2.0 (Authorization Code + PKCE) + JWT propio HS256 (PyJWT), 14 días, revocable por usuaria |
| Imágenes | Pillow 12 (normalización + variantes WebP) |
| Panel de admin | SQLAdmin 0.32 (`/admin`) + fastapi-flare (`/flare`, errores y métricas) |
| Pruebas | pytest + pytest-asyncio + httpx, contra Postgres real |

## Arquitectura

```
app/
  main.py            app FastAPI: CORS, handlers de error, /fotos, /admin, /flare
  admin.py           vistas de SQLAdmin y login del panel
  schemas.py         modelos Pydantic (camelCase en el JSON, snake_case en Python)
  serializers.py     ORM -> JSON del contrato
  core/
    config.py        Settings (variables de entorno, validación de secretos)
    db.py            engine y sesión async
    deps.py          usuaria_actual (JWT bearer, rechaza cuentas eliminadas)
    security.py      emisión/validación del JWT propio
    google_oauth.py  PKCE, intercambio de code, validación del id_token
    errors.py        ApiError -> {"error": {"codigo", "mensaje"}}
  domain/
    costos.py        prorrateo de lotes (réplica exacta de web/src/domain/costos.ts)
    fotos.py         validación, normalización, variantes y Almacen
  models/models.py   tablas: usuarias, lotes, fotos, prendas, ventas, uso_ia_diario
  routers/           auth, lotes, prendas, ventas, reportes, ia
scripts/
  backup_diario.sh   pg_dump -Fc + copia de fotos, retención 14 días
  purgar_usuarias.py borrado definitivo de cuentas eliminadas hace > 30 días
```

Decisiones de diseño:

- **Aislamiento por usuaria.** Toda consulta filtra por `usuaria_id` a través de
  la dependencia `usuaria_actual`. Acceder a un recurso ajeno responde `404`,
  nunca `403`, para no revelar que existe.
- **Transacciones.** El prorrateo del lote se recalcula en la misma transacción
  que crea o edita prendas y lotes, o que descarta una prenda. Registrar una venta
  y marcar la prenda como vendida ocurren juntos; una segunda venta de la misma
  prenda responde `409 YA_VENDIDA`.
- **Fotos.** Máximo 5 MB y deben decodificar como imagen real (si no, `422`).
  Se normalizan (orientación EXIF, sin metadatos, RGB), se deduplican por
  `(usuaria_id, sha256)` y se guardan dos variantes WebP: `mini` (320 px, calidad
  78) y `detalle` (1024 px, calidad 80). La ruta es
  `FOTOS_DIR/ab/cd/<sha256>_<variante>.webp`. El almacenamiento va detrás de la
  interfaz `Almacen` (`AlmacenLocal` hoy), para poder pasar a S3/R2 sin tocar la
  base de datos. FastAPI sirve `/fotos` con
  `Cache-Control: public, max-age=31536000, immutable`.
- **Borrado de cuenta.** `DELETE /auth/me` hace un soft delete y bloquea el
  acceso de inmediato. Si la usuaria vuelve a entrar con Google antes de 30
  días, la cuenta se reactiva. Pasado ese plazo, `scripts/purgar_usuarias.py`
  borra la cuenta en cascada y sus archivos de fotos, sin tocar los que
  comparta otra usuaria.
- **Formato de error.** Todo error sigue `{"error": {"codigo", "mensaje"}}`.
  fastapi-flare instala sus propios handlers de excepción, así que `main.py`
  vuelve a registrar los del proyecto después de `setup_flare()`.
- **IA.** `/ia/analizar-foto` es un stub: responde `200` con los campos en
  `null` y `confianza: 0`, y solo aplica el límite diario (`429`).

### Desviaciones respecto a la spec

1. **Sin Caddy propio.** El `docker-compose.yml` solo define `api` y `db`. El
   reverse proxy con TLS es externo: un Caddy compartido llega a `api` por una
   red Docker externa.
2. **FastAPI sirve las fotos**, en vez de Caddy leyéndolas directo del disco.
3. **El firewall no forma parte de este repo.**
4. **`/ia/analizar-foto` es un stub** (ver arriba).
5. **Tabla extra `uso_ia_diario`**, necesaria para el `429 LIMITE_DIARIO_IA` del
   contrato.
6. **Columna extra `usuarias.eliminada_en`** para el soft delete (migración 0002).

## Variables de entorno

Copia `.env.example` a `.env`. Nunca subas el `.env` al repo.

| Variable | Ejemplo | Notas |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://bazaria:<password>@db:5432/bazaria` | |
| `POSTGRES_PASSWORD` | `<password>` | La usa el contenedor `db` |
| `JWT_SECRET` | `<64+ caracteres aleatorios>` | Obligatoria: la app no arranca con un valor de plantilla |
| `GOOGLE_CLIENT_ID` | `<id>.apps.googleusercontent.com` | |
| `GOOGLE_CLIENT_SECRET` | `<secreto>` | |
| `FRONTEND_URL` | `https://example.com` | Destino de la redirección tras el login |
| `FOTOS_DIR` | `/data/fotos` | |
| `FOTOS_BASE_URL` | `https://api.example.com/fotos` | |
| `ALLOWED_EMAILS` | `a@x.com,b@y.com` | Opcional; vacío = cualquier cuenta de Google |
| `ADMIN_USERNAME` | `admin` | Login de `/admin` y `/flare` |
| `ADMIN_PASSWORD` | `<password>` | Obligatoria, sin valor por defecto |
| `ADMIN_SECRET_KEY` | `<aleatorio>` | Firma la cookie del panel. Obligatoria |
| `ADMIN_LECTOR_USERNAME` | `colaborador` | Opcional. Cuenta de solo lectura del panel |
| `ADMIN_LECTOR_PASSWORD` | `<16+ caracteres>` | Obligatoria si hay usuario lector |
| `EXPONER_DOCS` | `false` | `true` solo en desarrollo: muestra `/docs`, `/redoc`, `/openapi.json` |
| `FLARE_SQLITE_PATH` | `/data/flare/flare.sqlite3` | Opcional |

Genera los secretos con `python -c "import secrets; print(secrets.token_urlsafe(48))"`.

El login del panel de admin es independiente del de las usuarias: un JWT de
usuaria no abre `/admin` ni `/flare`, y la sesión del panel no sirve para la API.

Roles del panel:

- **Admin** (`ADMIN_USERNAME`): ve todo y puede editar lo editable (hoy, solo el
  estado de borrado de una usuaria).
- **Lector** (`ADMIN_LECTOR_USERNAME`, opcional): ve listas y detalles de `/admin`
  y `/flare`, sin botones de editar, borrar ni exportar. El servidor rechaza con
  `403` cualquier escritura de esta cuenta aunque se arme la petición a mano
  (`SoloLecturaAdminMiddleware`).

Tras 5 intentos fallidos en 15 minutos, la IP queda bloqueada para el login del panel.

## Correr

```bash
cp .env.example .env        # y rellenar los valores
docker compose up -d --build
docker compose exec api alembic upgrade head
curl -s http://127.0.0.1:8100/health          # {"status":"ok"}
curl -sD- -o /dev/null http://127.0.0.1:8100/auth/google   # 302 a accounts.google.com
```

Si no hay sesión, `/auth/me` debe responder `401` con `{"error": {...}}`.

Para actualizar: `git pull && docker compose up -d --build && docker compose exec api alembic upgrade head`.

## Pruebas

Las pruebas usan un Postgres real, no SQLite: el esquema depende de tipos y
constraints propios de Postgres.

```bash
docker run -d --name bazaria-test-pg \
  -e POSTGRES_DB=bazaria_test -e POSTGRES_USER=bazaria -e POSTGRES_PASSWORD=bazaria \
  -p 127.0.0.1:5434:5432 postgres:16.6

python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
python -m pytest -q          # 43 passed
```

`tests/conftest.py` define todas las variables obligatorias, así que la suite
corre en un clon limpio sin `.env`.

| Archivo | Qué cubre |
|---|---|
| `test_costos.py` | Prorrateo (réplica de `web/src/domain/costos.ts`) |
| `test_prendas_lotes_ventas.py` | CRUD, foto real, venta transaccional, reportes |
| `test_aislamiento_usuarias.py` | Una usuaria nunca ve ni edita datos de otra (`404`) |
| `test_soft_delete.py` | `DELETE /auth/me`, bloqueo inmediato, purga a los 30 días |
| `test_correcciones.py` | Fotos compartidas al purgar, orden del remanente, lote ajeno, doble venta, secreto JWT de plantilla |
| `test_panel_admin.py` | `/flare` responde `401` sin sesión de admin, también con un JWT de usuaria |
| `test_admin_lector.py` | La cuenta lectora ve todo y recibe `403` al editar o borrar; el admin conserva sus permisos |

fastapi-flare abre una conexión SQLite que solo se cierra en el lifespan de la
app. `ASGITransport` no ejecuta el lifespan, así que `conftest.py` la cierra al
final; si no, pytest se queda colgado al salir.

## Privacidad

- Los datos de cada usuaria solo son accesibles con su propio JWT.
- Una cuenta borrada se purga a los 30 días, con su cascada en la base de datos y sus archivos de fotos.
- Los respaldos diarios guardan esos datos hasta que vencen (14 días).
- Todavía no hay endpoint para exportar los datos de una usuaria.
- Las fotos solo se sirven con enlace firmado (HMAC con clave derivada de `JWT_SECRET`)
  y caducidad; sin firma, `403 ENLACE_INVALIDO`.

## Dependencias y seguridad

Revisar con `uvx pip-audit -r requirements.txt` antes de cada despliegue grande.
Última revisión: 16 oct 2026, sin vulnerabilidades explotables. Quedan dos avisos
aceptados conscientemente:

| Aviso | Por qué no aplica aquí |
|---|---|
| `python-jose` PYSEC-2026-4298 y `ecdsa` PYSEC-2026-1325 | El código de Bazaria ya no los usa (migrado a PyJWT 2.15.1 el 2026-10-19). Siguen instalados solo como dependencia de `fastapi-flare`, que los importa únicamente para login con Zitadel (desactivado aquí): nunca se ejecutan. |

PyJWT: no se usa `PyJWKClient` (concentra los avisos publicados de 2026); las llaves de Google
las descarga `core/google_oauth.py` con refresco por `kid` y cada hora.
