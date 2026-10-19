# Contributing

[Español](../es/contributing.md)

Thanks for helping. Bazaria is MIT-licensed and free to use; contributions are released
under the same license.

## Setup

```bash
cd web
npm install
npm run dev:demo
```

## Before opening a PR

```bash
cd web
npx tsc -b --noEmit
npm run lint
npm run test
npm run build:demo && npm run check:bundle
```

## Conventions

- **Business logic goes in `web/src/domain`**: pure functions, no React, no I/O, with a Vitest
  test next to it.
- UI code talks to `DataSource`, never to IndexedDB or `fetch` directly.
- Money is integers in cents.
- TypeScript is strict. No `any` without a reason.
- Keep it simple: no abstractions "for later".
- Commits are small and describe one change.
- Source identifiers are in Spanish (domain vocabulary: `prenda`, `lote`, `venta`); docs are
  bilingual. If you change a doc, update both `docs/en` and `docs/es`.

## Security and privacy

- Never commit `.env`, keys, or real user data.
- Secrets never use the `VITE_` prefix: Vite would bundle them into the browser.
- Report vulnerabilities privately via GitHub Security Advisories, not in public Issues.

## Questions and bugs

Questions: Discussions. Bugs and feature requests: Issues, with steps to reproduce.
