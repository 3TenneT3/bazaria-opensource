# Getting started

[Español](../es/getting-started.md)

## Requirements

- Node.js 20+
- npm

## Run locally

The frontend lives in `web/`. Run every `npm` command from there:

```bash
cd web
npm install
npm run dev:demo
```

Open <http://localhost:5173>. Demo mode needs no backend: data lives in your browser's IndexedDB.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` / `npm run dev:demo` | Dev server (demo mode) |
| `npm run build` | Production build (uses `VITE_MODE` from the environment) |
| `npm run build:demo` | Demo build (forces `--mode demo`) |
| `npm run test` | Run Vitest once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run lint` | oxlint |
| `npm run preview` | Serve the build locally |
| `npm run check:bundle` | Fails if `/dist` contains API URLs or secrets (run after `build:demo`) |

## Environment

Demo mode needs nothing. To change settings, create `web/.env`:

```bash
VITE_MODE=demo
VITE_API_URL=
OPENAI_API_KEY=
```

| Variable | Meaning |
|---|---|
| `VITE_MODE` | `demo` (IndexedDB, simulated AI) or `api` (real backend) |
| `VITE_API_URL` | Backend URL, only used when `VITE_MODE=api` |
| `OPENAI_API_KEY` | Optional key for image generation. Server-side only: it has no `VITE_` prefix on purpose, so Vite never ships it to the browser |

`.env` is git-ignored. Never commit keys. The backend has its own template at
`backend/.env.example`.

## Demo data

On first open the app seeds 2 bales, 25 garments (original SVG illustrations in
`web/public/demo`) and about 15 sales over the last 45 days. The **Reset demo** button in the
top banner wipes everything and reloads the seed. Demo mode has no login. In `api` mode
the app asks for "Continue with Google" (handled by the backend).

## Deploy (Cloudflare Workers)

The frontend ships to Cloudflare Workers as static assets (`web/wrangler.jsonc`, project
`bazaria-web`, directory `./dist` inside `web/`). In the Cloudflare dashboard the project's
**Root directory** is `web`. Cloudflare **auto-deploys on every push to `main`**;
nothing to run by hand.

`wrangler.jsonc` already sets the SPA fallback (`not_found_handling:
single-page-application`), so routes like `/inventario` work on reload.

A production build against the real backend needs `VITE_MODE=api` and
`VITE_API_URL=https://api.example.com` (project variables in Cloudflare). To deploy by
hand:

```bash
cd web
npx wrangler login
VITE_MODE=api VITE_API_URL=https://api.example.com npm run build
npx wrangler deploy
```

For a public demo without backend, run `npm run build:demo && npm run check:bundle` before
deploying.
