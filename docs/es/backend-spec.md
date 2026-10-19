# Especificación del backend — Bazaria

Documento de traspaso para quien monte el backend en la VPS. El contrato de los
endpoints está en [api-contract.md](api-contract.md); este documento define **cómo
construirlo**: stack, esquema, fotos, login con Google, despliegue y escalado.

## Decisiones

| Tema | Decisión | Por qué |
|---|---|---|
| Lenguaje | Python 3.12 + **FastAPI** | Tipado con Pydantic, OpenAPI automático, async |
| Base de datos | **PostgreSQL 16** | Transacciones para el prorrateo de lotes, índices, respaldos probados |
| Acceso a datos | SQLAlchemy 2 (async) + Alembic | Migraciones versionadas en el repo |
| Auth | Google OAuth 2.0 (Authorization Code) → JWT propio | Sin contraseñas ni OTP |
| Fotos | **Archivo en disco + metadata en Postgres** (patrón de object storage) | Ver sección Fotos |
| Proxy / HTTPS | **Caddy** | Certificados automáticos y sirve las fotos estáticas |
| Despliegue | `git pull` en la VPS + `docker compose up -d --build` | Un solo comando, reproducible |

## Escalado vertical y horizontal

El diseño evita estado en el proceso para que ambos caminos funcionen sin reescribir:

- **Vertical (más máquina):** subir RAM/CPU de la VPS; aumentar `workers` de uvicorn
  (≈ 2 × núcleos) y ajustar `shared_buffers` / `work_mem` de Postgres.
- **Horizontal (más máquinas):**
  - La API es **stateless**: la sesión vive en el JWT, no en memoria. Se pueden correr N
    contenedores `api` detrás de Caddy/Nginx sin sticky sessions.
  - Los archivos se acceden por una interfaz `Almacen` (guardar/abrir/url). La
    implementación inicial es disco local; para varias máquinas se cambia por S3/R2
    (Cloudflare R2 es compatible con S3) **sin tocar la base de datos ni el frontend**,
    porque la base solo guarda la `llave` del archivo.
  - Postgres: primero vertical; después réplica de lectura para reportes. Pool de
    conexiones acotado (`pool_size` × nº de workers < `max_connections`).
- **Qué no hacer:** caches en memoria del proceso, archivos temporales compartidos entre
  workers, ids autoincrementales expuestos (se usan UUID).

## Esquema (PostgreSQL)

Todos los ids son `uuid` (generados en la API). Montos en **centavos** (`bigint`).
Cada fila de datos lleva `usuaria_id`; **toda consulta filtra por ella**.

```sql
create table usuarias (
  id          uuid primary key,
  google_sub  text not null unique,      -- identificador estable de Google
  email       text not null,
  nombre      text,
  creada_en   timestamptz not null default now()
);

create table lotes (
  id                   uuid primary key,
  usuaria_id           uuid not null references usuarias(id) on delete cascade,
  nombre               text not null,
  costo_total          bigint not null check (costo_total >= 0),
  piezas_compradas     int not null check (piezas_compradas > 0),
  piezas_descartadas   int not null default 0 check (piezas_descartadas >= 0),
  fecha_compra         timestamptz not null,
  notas                text,
  creado_en            timestamptz not null default now()
);

-- Una fila por archivo de foto. La prenda solo guarda la referencia.
create table fotos (
  id          uuid primary key,
  usuaria_id  uuid not null references usuarias(id) on delete cascade,
  sha256      char(64) not null,          -- contenido original; evita duplicados
  llave       text not null,              -- ej. 'ab/cd/abcd…ef' (sin extensión ni variante)
  mime        text not null default 'image/webp',
  bytes       int  not null,              -- tamaño de la variante 'detalle'
  ancho       int  not null,
  alto        int  not null,
  creada_en   timestamptz not null default now(),
  unique (usuaria_id, sha256)
);

create table prendas (
  id             uuid primary key,
  usuaria_id     uuid not null references usuarias(id) on delete cascade,
  lote_id        uuid references lotes(id) on delete set null,
  foto_id        uuid references fotos(id) on delete set null,
  tipo           text, color text, talla text, marca text,
  estado         text not null check (estado in ('nueva','seminueva','usada')),
  costo          bigint not null default 0 check (costo >= 0),
  costo_manual   boolean not null default false,
  precio_venta   bigint not null default 0 check (precio_venta >= 0),
  status         text not null default 'disponible'
                 check (status in ('disponible','apartada','vendida','descartada')),
  creada_en      timestamptz not null default now()
);
create index on prendas (usuaria_id, status);
create index on prendas (usuaria_id, lote_id);

create table ventas (
  id            uuid primary key,
  usuaria_id    uuid not null references usuarias(id) on delete cascade,
  prenda_id     uuid not null references prendas(id) on delete cascade,
  precio_final  bigint not null check (precio_final >= 0),
  costo_envio   bigint not null default 0,
  comision      bigint not null default 0,
  canal         text not null check (canal in ('instagram','whatsapp','bazar','otro')),
  fecha_venta   timestamptz not null
);
create index on ventas (usuaria_id, fecha_venta desc);
```

Regla de negocio: el prorrateo del costo del lote se recalcula **dentro de la misma
transacción** al crear/editar prendas o lotes (ver `web/src/domain/costos.ts` del frontend,
es la referencia de la fórmula). Las prendas con `costo_manual = true` no se tocan.

## Fotos: archivo en disco, metadata en la base

Así lo hacen las apps grandes: la base **no guarda binarios**, guarda un texto que
apunta al archivo (la *llave*) más sus metadatos; el archivo vive en un almacén de
objetos y se sirve con caché agresiva.

### Flujo de subida (`POST /prendas`, multipart)

1. Validar: ≤ 5 MB, `Content-Type` de imagen, y abrirla con Pillow (no confiar en la
   extensión). Rechazar con `422` si no decodifica.
2. Normalizar: corregir orientación EXIF, **quitar metadatos** (GPS, cámara), convertir
   a RGB.
3. `sha256` del archivo original. Si ya existe `(usuaria_id, sha256)`, reutilizar esa
   fila de `fotos` (deduplicación).
4. Generar **dos variantes WebP**:

   | Variante | Lado largo | Calidad | Uso | Peso típico |
   |---|---|---|---|---|
   | `mini` | 320 px | 78 | listas y cuadrículas | 10–25 KB |
   | `detalle` | 1024 px | 80 | pantalla de la prenda | 50–120 KB |

   WebP lossy conserva calidad visual con ~30 % menos peso que JPEG. (AVIF pesa menos
   aún pero codifica más lento; es opcional como mejora futura.)
5. Escribir los archivos con **nombre por contenido**:
   `{FOTOS_DIR}/{sha[0:2]}/{sha[2:4]}/{sha}_{variante}.webp`
   El prefijo de dos niveles evita directorios con miles de archivos.
6. Insertar la fila en `fotos` y la prenda con `foto_id`, todo en una transacción. Si la
   transacción falla, borrar los archivos recién escritos.

### Entrega

- La API devuelve `fotoUrl` y `fotoMiniUrl` como URLs absolutas bajo `FOTOS_BASE_URL`
  (ej. `https://api.tudominio.com/fotos/ab/cd/abcd…_detalle.webp`).
- **Caddy sirve `/fotos/*` directamente del disco** (sin pasar por Python) con
  `Cache-Control: public, max-age=31536000, immutable`. Como el nombre es el hash del
  contenido, nunca cambia: se puede cachear para siempre.
- Privacidad: las llaves son hashes de 64 caracteres no adivinables. Para un modelo más
  estricto, firmar las URLs con expiración (HMAC) y validarlas en Caddy; no es necesario
  para el MVP.

### Borrado

- Al eliminar una prenda, si ningún otro registro usa su `foto_id`, borrar la fila de
  `fotos` y sus archivos (tarea al final de la petición o job nocturno).
- Respaldar `FOTOS_DIR` junto con `pg_dump`: **base y archivos son un solo respaldo
  lógico**; uno sin el otro deja enlaces rotos.

### Migrar a S3/R2 después

Implementar `AlmacenS3` con la misma interfaz, copiar `FOTOS_DIR` al bucket
conservando las llaves y cambiar `FOTOS_BASE_URL`. La base de datos no se toca.

## Login con Google

1. `GET /auth/google` → redirige a Google con `state` aleatorio (guardado en cookie
   `HttpOnly; Secure; SameSite=Lax` de 10 min) y PKCE.
2. Google redirige a `GET /auth/google/callback?code=…&state=…`.
3. El backend valida `state`, intercambia el `code`, **verifica el `id_token`** (firma,
   `aud` = tu client id, `email_verified = true`) y hace `upsert` en `usuarias` por
   `google_sub`.
4. Emite un JWT propio (HS256, `sub = usuaria.id`, expiración 30 días) y redirige a
   `{FRONTEND_URL}/#token=<jwt>`. El frontend lo guarda y limpia el fragmento
   (ya implementado en `AuthGate.tsx`).
5. `GET /auth/me` valida el JWT y devuelve `{ "email": "…" }`.

Opcional: lista de correos permitidos (`ALLOWED_EMAILS`) mientras la app sea privada.

CORS: permitir solo `FRONTEND_URL`. En Google Cloud Console el redirect URI autorizado es
`https://api.tudominio.com/auth/google/callback`.

## Variables de entorno

```
DATABASE_URL=postgresql+asyncpg://bazar:***@db:5432/bazar
JWT_SECRET=<32+ bytes aleatorios>
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
FRONTEND_URL=https://tudominio.com
FOTOS_DIR=/data/fotos
FOTOS_BASE_URL=https://api.tudominio.com/fotos
ALLOWED_EMAILS=            # opcional, separados por coma
```

Nunca versionar `.env` del servidor. El frontend solo necesita `VITE_MODE=api` y
`VITE_API_URL=https://api.tudominio.com`.

## Despliegue (git pull + Docker Compose)

```
repo-backend/
  app/            # FastAPI
  alembic/        # migraciones
  Dockerfile
  docker-compose.yml
  Caddyfile
```

Servicios en `docker-compose.yml`: `api` (uvicorn), `db` (postgres:16, volumen
`pgdata`), `caddy` (80/443, monta `FOTOS_DIR` en solo lectura). Postgres **no expone
puertos** al exterior.

Actualizar: `git pull && docker compose up -d --build && docker compose exec api alembic upgrade head`.

### Respaldos

- `pg_dump -Fc` diario (cron) + copia de `FOTOS_DIR` (`rsync` o `restic`) a otro lugar
  (otro servidor o un bucket), con retención de 14 días. Probar una restauración.
- Firewall: abrir solo 22 (con llave), 80 y 443.

## Límites y seguridad

- 5 MB por foto, `image/*` verificado por decodificación.
- Límite diario de análisis de IA por usuaria (429), rate limiting general.
- Aislamiento: toda consulta `WHERE usuaria_id = :yo`; los ids de la URL se verifican
  contra la usuaria. Pruebas automáticas que intenten leer datos de otra usuaria.
- Montos y fechas validados en servidor; nunca confiar en totales del cliente.

## Orden sugerido de construcción

1. Esqueleto FastAPI, Postgres, Alembic con el esquema de arriba.
2. Login con Google + `/auth/me` + dependencia `usuaria_actual`.
3. CRUD de lotes y prendas (con prorrateo transaccional) y ventas.
4. Pipeline de fotos (Pillow, WebP, `Almacen` local) y Caddy sirviendo `/fotos`.
5. Reportes (`resumen-mes`, `resumen-lote`).
6. Compose, respaldos y despliegue.
7. Análisis de foto con IA (`/ia/analizar-foto`) al final, es opcional para operar.
