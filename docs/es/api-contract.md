# Contrato de API — Bazaria

[English](../en/api-contract.md)

Este documento define el contrato REST que el backend (Python/FastAPI) debe implementar para que
`ApiDataSource` (frontend) funcione sin cambios. El modo demo (`VITE_MODE=demo`) no usa
este contrato; se activa con `VITE_MODE=api` y `VITE_API_URL`.

## Convenciones generales

- Todos los montos van en **centavos** (enteros).
- Todas las fechas en **ISO 8601 UTC** (ej. `2024-03-15T18:30:00.000Z`).
- Todos los ids son **string**.
- Autenticación: header `Authorization: Bearer <token>` en todos los endpoints excepto
  `/auth/google` y `/auth/google/callback`.
- Cada usuaria **solo ve sus propios datos** (lotes, prendas, ventas); el backend debe
  filtrar por usuaria autenticada en cada consulta, nunca confiar en el cliente.
- Formato de error estándar:
  ```json
  { "error": { "codigo": "CODIGO_ERROR", "mensaje": "Mensaje legible para la usuaria" } }
  ```
- Códigos HTTP relevantes: `401` sesión inválida/expirada, `404` recurso no encontrado,
  `422` validación fallida, `429` límite diario de IA alcanzado.
- Subida de fotos: `multipart/form-data`, máximo **5 MB**, solo `image/*`.

## Auth

Login con Google (OAuth 2.0). Detalle de implementación en
[backend-spec.md](backend-spec.md#login-con-google).

### `GET /auth/google`
Redirige (`302`) a Google. No requiere token.

### `GET /auth/google/callback?code=&state=`
Lo llama Google. Valida el `id_token`, crea o actualiza a la usuaria y redirige (`302`) a
`{FRONTEND_URL}/#token=<jwt>`. El frontend guarda el token y limpia el fragmento.

Errores: redirige a `{FRONTEND_URL}/#error=acceso_denegado` si la cuenta no está permitida.

### `GET /auth/me`
Response `200`: `{ "email": "vendedora@correo.com" }`
Errores: `401` si el token no es válido.

### `DELETE /auth/me`
Soft delete de la cuenta. Response `204`. El acceso se bloquea de inmediato (`401` con el
mismo token). Los datos se purgan definitivamente a los 30 días; si la usuaria vuelve a
iniciar sesión con Google antes, la cuenta se reactiva.

## Ids generados por el cliente (captura sin conexión)

`POST /lotes`, `POST /prendas` (dentro de `data`) y `POST /prendas/:id/venta` aceptan un `id` opcional (UUID elegido por el cliente). Crear con un id que ya es de la misma usuaria devuelve el registro existente, así que reintentar es seguro. Un id que pertenece a otra usuaria responde `409 ID_EN_USO`. `POST /prendas` acepta además `creadoEn` y la venta `fechaVenta` (hora real de captura); las fechas futuras se ignoran.

## Lotes

### `GET /lotes`
Response `200`: `Lote[]`
```json
[
  {
    "id": "lote_123",
    "nombre": "Paca americana sept",
    "costoTotal": 350000,
    "piezasCompradas": 60,
    "piezasDescartadas": 4,
    "fechaCompra": "2024-09-15T00:00:00.000Z",
    "notas": null
  }
]
```

### `POST /lotes`
Request: igual forma que un `Lote` sin `id`.
Response `201`: `Lote` creado.

### `PATCH /lotes/:id`
Request: campos parciales de `Lote`.
Response `200`: `Lote` actualizado.

**Regla de negocio crítica:** al cambiar `costoTotal`, `piezasCompradas` o
`piezasDescartadas`, el backend **recalcula el prorrateo** de todas las prendas vigentes
del lote (status distinto de `descartada`), excepto las que tienen `costoManual=true`
(su costo se resta del total antes de prorratear). El residuo de centavos se asigna a la
última prenda en orden de creación, para que la suma cuadre exacto. Ver
`web/src/domain/costos.ts` en el frontend como especificación de referencia exacta de esta
lógica — el backend debe replicarla bit a bit.

### `DELETE /lotes/:id`
Response `204`. Las prendas del lote quedan con `loteId: null` (no se borran).

## Prendas

### `GET /prendas?status=&tipo=&talla=&loteId=&texto=`
Todos los query params son opcionales. Response `200`: `Prenda[]`.
```json
{
  "id": "prenda_456",
  "loteId": "lote_123",
  "fotoUrl": "https://api.ejemplo.com/fotos/ab/cd/abcd…_detalle.webp",
  "fotoMiniUrl": "https://api.ejemplo.com/fotos/ab/cd/abcd…_mini.webp",
  "tipo": "blusa",
  "color": "lila",
  "talla": "M",
  "marca": null,
  "estado": "seminueva",
  "costo": 6250,
  "costoManual": false,
  "precioVenta": 15000,
  "status": "disponible",
  "creadoEn": "2024-09-20T10:00:00.000Z"
}
```

### `GET /prendas/:id`
Response `200`: `Prenda`. `404` si no existe o no pertenece a la usuaria.

### `POST /prendas` (multipart/form-data)
Campos: `foto` (archivo, máx 5MB, solo imagen) + `data` (JSON string con los mismos
campos que `CrearPrendaInput` del frontend: `loteId`, `tipo`, `color`, `talla`, `marca`,
`estado`, `costo`, `costoManual`, `precioVenta`).

Response `201`: `Prenda` creada, con `fotoUrl` (WebP 1024 px) y `fotoMiniUrl` (WebP 320 px) ya resueltas. El backend
normaliza la foto, genera ambas variantes y guarda solo la metadata (ver
[backend-spec.md](backend-spec.md#fotos-archivo-en-disco-metadata-en-la-base)).

**Regla de negocio:** si `loteId` no es null, el lote debe ser de la usuaria (`404` si no
existe o es de otra) y el backend recalcula el prorrateo del lote tras insertar la nueva
prenda (misma lógica que en `PATCH /lotes/:id`). Lo mismo aplica a `loteId` en
`PATCH /prendas/:id`.

### `PATCH /prendas/:id`
Request: campos parciales. Response `200`: `Prenda` actualizada.

### `PATCH /prendas/:id/status`
Request: `{ "status": "apartada" | "disponible" | "vendida" | "descartada" }`
Response `200`: `Prenda` actualizada.

**Regla de negocio:** si el nuevo status es `descartada` y la prenda pertenece a un lote,
el backend recalcula el prorrateo del lote excluyendo esa prenda del reparto.

## Ventas

### `POST /prendas/:id/venta`
Request:
```json
{ "precioFinal": 15000, "costoEnvio": 8000, "comision": 0, "canal": "instagram" }
```
Response `201`: `Venta` creada. Errores: `409 YA_VENDIDA` si la prenda ya está vendida
(deshacer la venta primero con `DELETE /ventas/:id`).

**Regla de negocio crítica:** registrar la venta y marcar la prenda como `vendida` debe
ocurrir en la **misma transacción** de base de datos. Si algo falla, ninguna de las dos
operaciones debe persistir.

### `GET /ventas?desde=&hasta=`
Query params opcionales (ISO 8601). Response `200`: `Venta[]`.

### `DELETE /ventas/:id`
"Deshacer venta": borra la venta y regresa la prenda asociada a status `disponible`.
Response `204`.

## IA de visión

### `POST /ia/analizar-foto` (multipart/form-data: `foto`)
Response `200`:
```json
{
  "tipo": "blusa",
  "color": "lila",
  "talla": "M",
  "marca": null,
  "estado": "seminueva",
  "confianza": 0.86
}
```
Todos los campos excepto `confianza` pueden ser `null` si la IA no está segura.

Errores: `429` al pasar el límite diario (`codigo: "LIMITE_DIARIO_IA"`), con mensaje
"Llegaste al límite de análisis de hoy, captura manual". El backend debe registrar cada
llamada en una tabla de uso diario por usuaria para aplicar este límite.

## Reportes

### `GET /reportes/resumen-mes?anio=2024&mes=3`
Response `200`:
```json
{
  "anio": 2024,
  "mes": 3,
  "totalVentas": 125000,
  "gananciaNeta": 68000,
  "numeroPrendasVendidas": 12,
  "topTipos": [{ "tipo": "vestido", "ganancia": 25000 }],
  "prendasEstancadas": [ /* Prenda[] con más de 30 días sin venderse */ ]
}
```

### `GET /reportes/resumen-lote/:id`
Response `200`:
```json
{
  "lote": { "...": "Lote" },
  "recuperado": 280000,
  "faltante": 70000,
  "costoUnitarioActual": 6250
}
```

## Límites y seguridad esperados en el backend real

- Subida de fotos: máximo 5 MB, solo `image/*`, rechazar cualquier otro tipo con `422`.
- Límite diario de llamadas a IA por usuaria, configurable (ej. 50/día), con `429` al
  excederlo.
- HTTPS obligatorio en producción.
- Aislamiento estricto de datos por usuaria (nunca confiar en ids del cliente sin
  verificar propiedad).
- Rate limiting general en todos los endpoints para mitigar abuso.
