# Inicio rápido

[English](../en/getting-started.md)

## Requisitos

- Node.js 20+
- npm

## Correr en local

El frontend vive en `web/`. Todos los comandos `npm` se corren desde ahí:

```bash
cd web
npm install
npm run dev:demo
```

Abre <http://localhost:5173>. El modo demo no necesita backend: los datos viven en el
IndexedDB de tu navegador.

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` / `npm run dev:demo` | Servidor de desarrollo (modo demo) |
| `npm run build` | Build de producción (usa `VITE_MODE` del entorno) |
| `npm run build:demo` | Build de demo (fuerza `--mode demo`) |
| `npm run test` | Corre Vitest una vez |
| `npm run test:watch` | Vitest en modo watch |
| `npm run lint` | oxlint |
| `npm run preview` | Sirve el build localmente |
| `npm run check:bundle` | Falla si `/dist` contiene URLs de API o secretos (correr después de `build:demo`) |

## Entorno

Para el modo demo no hace falta nada. Si necesitas cambiar algo, crea un `web/.env`:

```bash
VITE_MODE=demo
VITE_API_URL=
OPENAI_API_KEY=
```

| Variable | Significado |
|---|---|
| `VITE_MODE` | `demo` (IndexedDB, IA simulada) o `api` (backend real) |
| `VITE_API_URL` | URL del backend, solo se usa con `VITE_MODE=api` |
| `OPENAI_API_KEY` | Llave opcional para generar imágenes. Solo del lado del servidor: no lleva prefijo `VITE_` a propósito, para que Vite nunca la mande al navegador |

`.env` está en `.gitignore`. Nunca subas llaves al repo. El backend tiene su propia
plantilla en `backend/.env.example`.

## Datos de ejemplo

Al abrir la app por primera vez se precargan 2 lotes, 25 prendas (ilustraciones SVG propias
en `web/public/demo`) y unas 15 ventas de los últimos 45 días. El botón **Reiniciar demo** del
banner superior borra todo y vuelve a cargar el seed. La demo no pide login. En modo
`api` la app pide "Continuar con Google" (lo resuelve el backend).

## Deploy (Cloudflare Workers)

El frontend se publica en Cloudflare Workers como assets estáticos (`web/wrangler.jsonc`,
proyecto `bazaria-web`, directorio `./dist` dentro de `web/`). En el panel de Cloudflare el
**Root directory** del proyecto es `web`. Cloudflare **se autodespliega al hacer push a
`main`**; no hay que correr nada a mano.

`wrangler.jsonc` ya configura el fallback de SPA (`not_found_handling:
single-page-application`), así que rutas como `/inventario` funcionan al recargar.

Para producción con backend real, el build necesita `VITE_MODE=api` y
`VITE_API_URL=https://api.example.com` (variables del proyecto en Cloudflare). Para
desplegar a mano:

```bash
cd web
npx wrangler login
VITE_MODE=api VITE_API_URL=https://api.example.com npm run build
npx wrangler deploy
```

Para una demo pública sin backend, usa `npm run build:demo && npm run check:bundle` antes
de desplegar.
