<p align="center">
  <img src="docs/assets/banner.svg" alt="Bazaria" width="100%">
</p>

<p align="center">
  <b>Know what every garment cost you, what you sell it for, and what you really earn.</b><br>
  Free, open-source, mobile-first web app for clothing resellers who sell on Instagram.
</p>

<p align="center">
  <a href="https://bazaria.com.mx">🌐 bazaria.com.mx</a> ·
  <a href="README.es.md">🇲🇽 Español</a> ·
  <a href="docs/en/getting-started.md">Quick start</a> ·
  <a href="docs/en/architecture.md">Architecture</a> ·
  <a href="docs/en/api-contract.md">API contract</a> ·
  <a href="docs/en/contributing.md">Contributing</a>
</p>

<p align="center">
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-green">
  <img alt="React" src="https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white">
  <img alt="Tailwind" src="https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss&logoColor=white">
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-Python_3.12-009688?logo=fastapi&logoColor=white">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-16-4169e1?logo=postgresql&logoColor=white">
  <img alt="PWA" src="https://img.shields.io/badge/PWA-installable-5a0fc8">
</p>

---

## What is Bazaria?

Resellers of second-hand, bale ("paca") or new clothing usually track costs in their head.
Bazaria takes a photo of each garment, spreads the cost of a whole bale across its pieces,
and tells you **how much each piece cost, how much to charge, and how much you really make**
once shipping and fees are counted.

- **The app is free to use**, and the code is MIT-licensed. Fork it, change it, sell it.
- **Local-first:** in demo mode everything lives in your browser (IndexedDB). No account, no server.
- **Installable:** works as a PWA from your phone's home screen. You can capture garments and sales without a signal; they sync when you reconnect.

> Want it hosted and maintained for you? Running it on the author's servers is a paid
> service. The software itself is, and will stay, free. Open a Discussion to ask about it.

## Features

**Inventory**
- ✅ Add a garment from a photo (image compressed to 1024px, EXIF-aware)
- ✅ Grid with filters by type, size, status and bale
- ✅ Statuses: available, reserved, sold, discarded

**Costs & profit**
- ✅ Bale cost spread across pieces, cent-exact (remainder goes to the last piece)
- ✅ Manual cost override per garment
- ✅ Profit per sale including shipping and commission
- ✅ Bale recovery bar: how much of the bale you have already paid back

**Insights**
- ✅ Home dashboard with tied-up capital and rotation
- ✅ Monthly summary: sales, net profit, top 3 types, stale garments (30+ days)
- ✅ Export the monthly report to Excel

**Import & export**
- ✅ Download an Excel template, fill it in and import your whole inventory
- ✅ Export your inventory to Excel (and re-import it)
- ✅ Row-by-row error report when importing

**Accounts (api mode)**
- ✅ Sign in with Google; each user only sees their own data

**Experience**
- ✅ Undo a sale within 5 seconds
- ✅ Light and dark mode
- ✅ Mobile-first, ≥44px touch targets, visible focus, labels
- ✅ Offline capture: add garments and sales without a signal; changes queue on your phone and sync on reconnect (sign in once online first)

**Planned**
- 🚧 Real backend (Python/FastAPI + PostgreSQL, see [backend spec](docs/es/backend-spec.md)) behind the documented [API contract](docs/en/api-contract.md)
- 🚧 Vision AI to auto-fill type, color and size from the photo
- 🚧 Lazy-load the Excel export to shrink the main bundle

## Documentation

| Guide | English | Español |
|---|---|---|
| Getting started | [en](docs/en/getting-started.md) | [es](docs/es/getting-started.md) |
| Architecture | [en](docs/en/architecture.md) | [es](docs/es/architecture.md) |
| API contract | [en](docs/en/api-contract.md) | [es](docs/es/api-contract.md) |
| Contributing | [en](docs/en/contributing.md) | [es](docs/es/contributing.md) |

## Quick start

```bash
git clone https://github.com/3TenneT3/bazaria-opensource.git
cd bazaria-opensource/web
npm install
npm run dev:demo
```

Open <http://localhost:5173>.

## Architecture

| Layer | Path | Role |
|---|---|---|
| Domain | `web/src/domain` | Pure business logic (costs, profit, summaries), unit-tested |
| Data | `web/src/data` | `DataSource` interface: `DemoDataSource` (IndexedDB) and `ApiDataSource` |
| Features | `web/src/features` | Inventory, add garment, sales, bales, dashboard, export |
| UI | `web/src/components` | Shared components |

`VITE_MODE=demo` uses the browser database; `VITE_MODE=api` talks to a backend that follows
the [API contract](docs/en/api-contract.md).

## Project structure

```
web/              frontend (React + Vite + TypeScript), deployed to Cloudflare Workers
  src/
    domain/       pure logic + tests
    data/         DataSource, DemoDataSource, ApiDataSource, seed
    features/     inventario, alta-prenda, lotes, dashboard, exportar
    components/   shared UI
    lib/          image compression, MXN formatting, dates
  public/demo/    25 original SVG illustrations used by the seed
  scripts/        check-bundle and seed image generators
  wrangler.jsonc  Cloudflare Workers config
backend/          API (Python + FastAPI + PostgreSQL), see backend/README.md
docs/
  en/ es/         bilingual guides
```

## Privacy

Demo mode sends nothing anywhere: garments, bales, sales and photos stay in your browser.
`npm run check:bundle` fails if the build output contains API URLs or secrets. API keys go
in `web/.env`, which is git-ignored, and never carry the `VITE_` prefix.

## Contributing

PRs and ideas are welcome. Read [docs/en/contributing.md](docs/en/contributing.md).
Questions go to Discussions, bugs and requests to Issues.

## License

[MIT](LICENSE). Free to use, modify and distribute, including commercially.
