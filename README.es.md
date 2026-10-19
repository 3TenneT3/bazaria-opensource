<p align="center">
  <img src="docs/assets/banner.svg" alt="Bazaria" width="100%">
</p>

<p align="center">
  <b>Sabe cuánto te costó cada prenda, en cuánto la das y cuánto ganas de verdad.</b><br>
  App web gratuita, de código abierto y mobile-first para vendedoras de ropa por Instagram.
</p>

<p align="center">
  <a href="https://bazaria.com.mx">🌐 bazaria.com.mx</a> ·
  <a href="README.md">🇺🇸 English</a> ·
  <a href="docs/es/getting-started.md">Inicio rápido</a> ·
  <a href="docs/es/architecture.md">Arquitectura</a> ·
  <a href="docs/es/api-contract.md">Contrato de API</a> ·
  <a href="docs/es/contributing.md">Contribuir</a>
</p>

<p align="center">
  <img alt="Licencia: MIT" src="https://img.shields.io/badge/licencia-MIT-green">
  <img alt="React" src="https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white">
  <img alt="Tailwind" src="https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss&logoColor=white">
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-Python_3.12-009688?logo=fastapi&logoColor=white">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-16-4169e1?logo=postgresql&logoColor=white">
  <img alt="PWA" src="https://img.shields.io/badge/PWA-instalable-5a0fc8">
</p>

---

## ¿Qué es Bazaria?

Quien vende ropa de paca, segunda mano o nueva casi siempre lleva los costos de memoria.
Bazaria toma una foto de cada prenda, reparte el costo de toda la paca entre sus piezas y
te dice **cuánto te costó cada una, en cuánto darla y cuánto ganas de verdad** después de
envío y comisiones.

- **La app es gratis** y el código es MIT. Fórkealo, cámbialo, véndelo.
- **Local primero:** en modo demo todo vive en tu navegador (IndexedDB). Sin cuenta, sin servidor.
- **Instalable:** funciona como PWA desde la pantalla de inicio del celular. Puedes capturar prendas y ventas sin señal; se sincronizan al reconectar.

> ¿Lo quieres hospedado y mantenido por alguien más? Usarlo en los servidores del autor es
> un servicio de pago. El software en sí es y seguirá siendo gratuito. Abre una Discusión
> para preguntar.

## Funciones

**Inventario**
- ✅ Alta de prenda desde una foto (imagen comprimida a 1024px, con EXIF)
- ✅ Cuadrícula con filtros por tipo, talla, estatus y lote
- ✅ Estatus: disponible, apartada, vendida, descartada

**Costos y ganancia**
- ✅ Costo de la paca prorrateado entre piezas, exacto al centavo (el residuo va a la última)
- ✅ Costo manual por prenda
- ✅ Ganancia por venta con envío y comisión
- ✅ Barra de recuperación del lote: cuánto de la paca ya pagaste

**Reportes**
- ✅ Inicio con capital parado y rotación
- ✅ Resumen mensual: ventas, ganancia neta, top 3 tipos, prendas estancadas (30+ días)
- ✅ Exportar el reporte mensual a Excel

**Importar y exportar**
- ✅ Descarga una plantilla de Excel, llénala e importa todo tu inventario
- ✅ Exporta tu inventario a Excel (y vuelve a importarlo)
- ✅ Reporte de errores por renglón al importar

**Cuentas (modo api)**
- ✅ Inicio de sesión con Google; cada usuaria solo ve sus propios datos

**Experiencia**
- ✅ Deshacer una venta en 5 segundos
- ✅ Modo claro y oscuro
- ✅ Mobile-first, áreas táctiles ≥44px, foco visible, etiquetas
- ✅ Captura sin conexión: agrega prendas y ventas sin señal; los cambios quedan en tu teléfono y se suben al reconectar (inicia sesión una vez con internet)

**Planeado**
- 🚧 Backend real (Python/FastAPI + PostgreSQL, ver [especificación](docs/es/backend-spec.md)) siguiendo el [contrato de API](docs/es/api-contract.md)
- 🚧 IA de visión para autollenar tipo, color y talla desde la foto
- 🚧 Carga diferida de la exportación a Excel para aligerar el bundle

## Documentación

| Guía | English | Español |
|---|---|---|
| Inicio rápido | [en](docs/en/getting-started.md) | [es](docs/es/getting-started.md) |
| Arquitectura | [en](docs/en/architecture.md) | [es](docs/es/architecture.md) |
| Contrato de API | [en](docs/en/api-contract.md) | [es](docs/es/api-contract.md) |
| Contribuir | [en](docs/en/contributing.md) | [es](docs/es/contributing.md) |

## Inicio rápido

```bash
git clone https://github.com/3TenneT3/bazaria-opensource.git
cd bazaria-opensource/web
npm install
npm run dev:demo
```

Abre <http://localhost:5173>.

## Arquitectura

| Capa | Ruta | Función |
|---|---|---|
| Dominio | `web/src/domain` | Lógica de negocio pura (costos, ganancia, resúmenes), con tests |
| Datos | `web/src/data` | Interfaz `DataSource`: `DemoDataSource` (IndexedDB) y `ApiDataSource` |
| Features | `web/src/features` | Inventario, alta de prenda, ventas, lotes, inicio, exportar |
| UI | `web/src/components` | Componentes compartidos |

`VITE_MODE=demo` usa la base del navegador; `VITE_MODE=api` habla con un backend que siga
el [contrato de API](docs/es/api-contract.md).

## Estructura del proyecto

```
web/              frontend (React + Vite + TypeScript), se despliega en Cloudflare Workers
  src/
    domain/       lógica pura + tests
    data/         DataSource, DemoDataSource, ApiDataSource, seed
    features/     inventario, alta-prenda, lotes, dashboard, exportar
    components/   UI compartida
    lib/          compresión de imágenes, formato MXN, fechas
  public/demo/    25 ilustraciones SVG originales usadas por el seed
  scripts/        check-bundle y generadores de imágenes del seed
  wrangler.jsonc  configuración de Cloudflare Workers
backend/          API (Python + FastAPI + PostgreSQL), ver backend/README.md
docs/
  en/ es/         guías bilingües
```

## Privacidad

El modo demo no envía nada a ningún lado: prendas, lotes, ventas y fotos se quedan en tu
navegador. `npm run check:bundle` falla si el build contiene URLs de API o secretos. Las
llaves de API van en `web/.env` (ignorado por git) y nunca llevan prefijo `VITE_`.

## Contribuir

Los PRs e ideas son bienvenidos. Lee [docs/es/contributing.md](docs/es/contributing.md).
Preguntas en Discussions, bugs y peticiones en Issues.

## Licencia

[MIT](LICENSE). Libre para usar, modificar y distribuir, también con fines comerciales.
