# API contract

[Español](../es/api-contract.md)

REST contract a backend must implement so `ApiDataSource` works unchanged. Demo mode
(`VITE_MODE=demo`) does not use it; enable it with `VITE_MODE=api` and `VITE_API_URL`.

JSON field names are the ones the frontend uses (Spanish: `lote`, `prenda`, `venta`).

## Conventions

- Money is **integer cents**. Dates are **ISO 8601 UTC**. Ids are **strings**.
- `Authorization: Bearer <token>` on every endpoint except `/auth/google` and `/auth/google/callback`.
- Each user only sees their own data. The backend filters by the authenticated user on every
  query and never trusts ids sent by the client.
- Error shape: `{ "error": { "codigo": "ERROR_CODE", "mensaje": "Human readable message" } }`
- Status codes: `401` invalid/expired session, `404` not found, `422` validation failed,
  `429` daily AI limit reached.
- Photo upload: `multipart/form-data`, max **5 MB**, `image/*` only.

## Auth

Sign in with Google (OAuth 2.0). Implementation details are in the
[backend spec](../es/backend-spec.md) (Spanish).

| Endpoint | Notes |
|---|---|
| `GET /auth/google` | `302` to Google. No token required |
| `GET /auth/google/callback?code=&state=` | Called by Google. Verifies the `id_token`, upserts the user and redirects (`302`) to `{FRONTEND_URL}/#token=<jwt>`. The frontend stores the token and clears the fragment. If the account is not allowed: `{FRONTEND_URL}/#error=acceso_denegado` |
| `GET /auth/me` | `200 { "email" }`; `401` if the token is invalid |
| `DELETE /auth/me` | Soft-deletes the account → `204`. Access is blocked immediately (`401` with the same token). Data is purged after 30 days; signing in with Google again before then reactivates the account |

## Client-generated ids (offline capture)

`POST /lotes`, `POST /prendas` (inside `data`) and `POST /prendas/:id/venta` accept an optional `id` (UUID chosen by the client). Creating with an id that already belongs to the same user returns the existing record, so retries are safe. An id that belongs to another user returns `409 ID_EN_USO`. `POST /prendas` also accepts `creadoEn` and the sale accepts `fechaVenta` (the real capture time); future dates are ignored.

## Bales (`/lotes`)

`Lote`: `id`, `nombre`, `costoTotal`, `piezasCompradas`, `piezasDescartadas`, `fechaCompra`, `notas|null`

| Endpoint | Notes |
|---|---|
| `GET /lotes` | `Lote[]` |
| `POST /lotes` | `Lote` without `id` → `201 Lote` |
| `PATCH /lotes/:id` | Partial `Lote` → `200 Lote` |
| `DELETE /lotes/:id` | `204`. Garments keep existing with `loteId: null` |

**Critical rule:** when `costoTotal`, `piezasCompradas` or `piezasDescartadas` change, the
backend recalculates the proration of every non-discarded garment in the bale, except those
with `costoManual=true` (their cost is subtracted from the total first). The cent remainder
goes to the last garment by creation order so the sum is exact. `web/src/domain/costos.ts` is
the exact reference: replicate it bit for bit.

## Garments (`/prendas`)

`Prenda`: `id`, `loteId|null`, `fotoUrl` (WebP, 1024 px), `fotoMiniUrl` (WebP, 320 px), `tipo`, `color`, `talla`, `marca|null`, `estado`,
`costo`, `costoManual`, `precioVenta`, `status`, `creadoEn`

| Endpoint | Notes |
|---|---|
| `GET /prendas?status=&tipo=&talla=&loteId=&texto=` | All params optional → `Prenda[]` |
| `GET /prendas/:id` | `404` if missing or not the user's |
| `POST /prendas` | multipart: `foto` + `data` (JSON of `CrearPrendaInput`) → `201 Prenda` with `fotoUrl` and `fotoMiniUrl` resolved (the backend normalizes the photo and generates both variants). If `loteId` is set it must belong to the user (`404` otherwise) and the bale is re-prorated. Same check on `loteId` in `PATCH /prendas/:id` |
| `PATCH /prendas/:id` | Partial → `200 Prenda` |
| `PATCH /prendas/:id/status` | `{ "status": "apartada" \| "disponible" \| "vendida" \| "descartada" }`. Discarding a garment in a bale re-prorates the bale without it |

## Sales

| Endpoint | Notes |
|---|---|
| `POST /prendas/:id/venta` | `{ "precioFinal", "costoEnvio", "comision", "canal" }` → `201 Venta`; `409 YA_VENDIDA` if the garment is already sold (undo the sale first). Creating the sale and marking the garment `vendida` happen in **one database transaction**, with a conditional `UPDATE` so concurrent requests cannot both succeed |
| `GET /ventas?desde=&hasta=` | Optional ISO dates → `Venta[]` |
| `DELETE /ventas/:id` | Undo (data-entry mistake): deletes the sale, garment returns to `disponible` → `204` |
| `POST /ventas/:id/devolucion` | Return / refund `{ reembolso, destino: disponible\|descartada\|cliente }`. Sale is kept; income = price − refund; shipping and fees still count → `200`. `409 YA_DEVUELTA`, `422 REEMBOLSO_MAYOR` |

## Vision AI

`POST /ia/analizar-foto` (multipart `foto`) → `200`:

```json
{ "tipo": "blusa", "color": "lila", "talla": "M", "marca": null, "estado": "seminueva", "confianza": 0.86 }
```

Every field except `confianza` may be `null` when the model is unsure. Over the daily limit
→ `429 LIMITE_DIARIO_IA`; the frontend then falls back to manual entry. Log each call in a
per-user daily usage table.

## Reports

- `GET /reportes/resumen-mes?anio=&mes=` → `{ anio, mes, totalVentas, gananciaNeta, numeroPrendasVendidas, topTipos: [{ tipo, ganancia }], prendasEstancadas: Prenda[] }` (stale = 30+ days unsold)
- `GET /reportes/resumen-lote/:id` → `{ lote, recuperado, faltante, costoUnitarioActual }`

## Expected backend limits and security

- Photos: max 5 MB, `image/*` only, anything else `422`.
- Configurable daily AI limit per user (for example 50/day), `429` when exceeded.
- HTTPS required in production.
- Strict per-user data isolation.
- General rate limiting on all endpoints.
