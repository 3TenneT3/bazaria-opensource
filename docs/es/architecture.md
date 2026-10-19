# Arquitectura

[English](../en/architecture.md)

## Resumen

Una SPA en React. Todas las pantallas hablan con una sola interfaz, `DataSource`, así que
la misma UI corre contra la base del navegador (demo) o contra un backend real (api).

```
features/*  ──►  DataSource (interfaz)  ──►  DemoDataSource  (IndexedDB, IA simulada)
     │                                  └─►  ApiDataSource   (REST, ver contrato de API)
     └──►  domain/*  (funciones puras, sin React, sin I/O)
```

## Capas

| Ruta | Función |
|---|---|
| `web/src/domain` | Tipos y lógica de negocio: prorrateo de lotes, ganancia, capital parado, rotación, recuperación de lote, resumen mensual. Pura y con tests. |
| `web/src/data` | Interfaz `DataSource`, `DemoDataSource` (IndexedDB con `idb`, fallback en memoria), `ApiDataSource`, seed, mock de visión |
| `web/src/features` | `inventario` (incluye importar/exportar Excel: `importarExportar.ts`), `alta-prenda`, `lotes`, `dashboard`, `exportar` (reporte Excel) |
| `web/src/components` | UI compartida: botones, tarjetas, bottom sheet, input de dinero, navbar, toast, tema, `AuthGate` (login con Google en modo api) |
| `web/src/lib` | Compresión de imágenes, formato MXN, fechas |

## Reglas clave (fuente de verdad: `web/src/domain/costos.ts`)

- El dinero se guarda en **centavos** (enteros).
- El costo del lote se reparte entre las piezas no descartadas; las que tienen costo manual
  se restan del total antes de prorratear.
- El residuo de centavos va a la última pieza (por orden de creación) para que la suma cuadre.
- Registrar una venta y marcar la prenda como vendida debe ser una sola operación atómica.

## Autenticación (modo api)

`AuthGate` envuelve la app. En modo demo deja pasar a todos. En modo api lee `#token=…` del
fragmento de la URL (lo pone el backend tras el OAuth de Google), lo guarda en
`localStorage`, limpia el fragmento y lo valida con `GET /auth/me`. Sin sesión válida muestra
el botón "Continuar con Google", que va a `{VITE_API_URL}/auth/google`. Un `401` en
cualquier petición borra el token y recarga.

## Importar / exportar Excel

En Inventario → Importar / exportar: descargar una plantilla (con hoja de instrucciones),
exportar el inventario actual o importar un archivo. Columnas: Tipo, Color, Talla, Marca,
Estado, Costo, Precio de venta (en pesos; se guardan en centavos). Lo exportado se puede
volver a importar; la columna `Status` se ignora al importar y todo entra como
disponible. Los renglones con error se omiten y se reportan por número de renglón.

## Stack

React · Vite · TypeScript (strict) · Tailwind CSS v4 · React Router · `vite-plugin-pwa` ·
`idb` · SheetJS (`xlsx`, instalado desde el tarball oficial de `cdn.sheetjs.com`) · Vitest ·
fuentes locales `@fontsource` (sin peticiones externas).

## Sin conexión (modo api)

En modo api, `OfflineDataSource` es local primero. Lecturas y escrituras van a un IndexedDB local (`bazaria-datos`); cada escritura también se apunta en un `outbox`. `MotorSync` sube el outbox en orden cuando hay conexión y después baja lotes, prendas y ventas y reemplaza la copia local (solo si no hay nada pendiente).

- **Ids del cliente:** el cliente crea los UUID y, en prendas y ventas, la hora real de captura. El backend los acepta y trata un alta repetida como idempotente, así que una respuesta perdida nunca duplica datos.
- **Conflictos:** gana el servidor. Un cambio rechazado (4xx) se descarta y se avisa a la usuaria; un `404` al borrar no es error.
- **Fotos:** las pendientes viven en IndexedDB; las ya subidas las guarda el service worker (`bazaria-fotos`, CacheFirst) y se pre-descargan tras cada sincronización.
- **Cambios atorados:** si el servidor responde 5xx tres veces seguidas a un cambio, se manda al final de la cola (sin borrarlo) para no bloquear los demás, y el banner lo muestra.
- **Necesita red:** el primer inicio de sesión, el reconocimiento por IA y eliminar la cuenta. Cerrar sesión se bloquea mientras haya cambios pendientes.
- **Sin resolver:** dos dispositivos editando lo mismo mientras ambos están sin conexión (gana el último en sincronizar).
