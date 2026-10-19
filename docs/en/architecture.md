# Architecture

[Español](../es/architecture.md)

## Overview

A single-page React app. All screens talk to one interface, `DataSource`, so the same UI
runs against a browser database (demo) or a real backend (api).

```
features/*  ──►  DataSource (interface)  ──►  DemoDataSource  (IndexedDB, simulated AI)
     │                                    └─►  ApiDataSource   (REST, see API contract)
     └──►  domain/*  (pure functions, no React, no I/O)
```

## Layers

| Path | Role |
|---|---|
| `web/src/domain` | Types and business logic: bale cost proration, profit, tied-up capital, rotation, bale recovery, monthly summary. Pure and unit-tested. |
| `web/src/data` | `DataSource` interface, `DemoDataSource` (IndexedDB via `idb`, in-memory fallback), `ApiDataSource`, seed, vision mock |
| `web/src/features` | `inventario` (including Excel import/export: `importarExportar.ts`), `alta-prenda`, `lotes`, `dashboard`, `exportar` (Excel report) |
| `web/src/components` | Shared UI: buttons, cards, bottom sheet, money input, navbar, toast, theme provider, `AuthGate` (Google sign-in in api mode) |
| `web/src/lib` | Image compression, MXN formatting, dates |

## Key rules (source of truth: `web/src/domain/costos.ts`)

- Money is stored in **cents** (integers).
- Bale cost is spread across non-discarded pieces; pieces with a manual cost are subtracted
  from the total first.
- The cent remainder goes to the last piece (by creation order) so the sum is exact.
- Recording a sale and marking the garment as sold must be one atomic operation.

## Auth (api mode)

`AuthGate` wraps the app. In demo mode it lets everyone through. In api mode it reads
`#token=…` from the URL fragment (set by the backend after Google OAuth), stores it in
`localStorage`, clears the fragment, and validates it with `GET /auth/me`. Without a valid
session it shows a "Continue with Google" button that goes to `{VITE_API_URL}/auth/google`.
A `401` from any request drops the token and reloads.

## Excel import / export

From Inventory → Import / export: download a template (with an instructions sheet), export
the current inventory, or import a file. Columns: Type, Color, Size, Brand, Condition, Cost,
Sale price (in pesos; stored as cents). Exported files can be re-imported; the `Status`
column is ignored on import and everything enters as available. Rows with errors are
skipped and reported by row number.

## Stack

React · Vite · TypeScript (strict) · Tailwind CSS v4 · React Router · `vite-plugin-pwa` ·
`idb` · SheetJS (`xlsx`, installed from the official `cdn.sheetjs.com` tarball) · Vitest ·
local `@fontsource` fonts (no external requests).

## Offline (api mode)

In api mode `OfflineDataSource` is local-first. Reads and writes go to a local IndexedDB (`bazaria-datos`); every write is also appended to an `outbox`. `MotorSync` uploads the outbox in order when there is a connection, then pulls lotes, prendas and ventas and replaces the local copy (only when nothing is pending).

- **Client-generated ids:** the client creates UUIDs and, for garments and sales, the real capture time. The backend accepts them and treats a repeated create as idempotent, so a lost response never duplicates data.
- **Conflicts:** the server wins. A rejected change (4xx) is dropped and the user is told; a `404` on a delete is not an error.
- **Photos:** pending photos live in IndexedDB; uploaded ones are cached by the service worker (`bazaria-fotos`, CacheFirst) and pre-fetched after each sync.
- **Stuck changes:** if the server answers 5xx three times in a row to a change, it moves to the end of the queue (never deleted) so it does not block the rest, and the banner shows it.
- **Needs the network:** first sign-in, AI recognition and account deletion. Closing the session is blocked while changes are pending.
- **Not solved:** two devices editing the same record while both are offline (last one to sync wins).
