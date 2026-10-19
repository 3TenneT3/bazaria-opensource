declare const __APP_VERSION__: string

/** Etapa del producto: alpha (pruebas internas) → beta (usuarias reales, con fallas) → estable. */
export const ETAPA = 'beta'

/** Versión de package.json, inyectada por Vite. En pruebas (sin Vite) cae a "0.1.0". */
export const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.0'

/** "Beta 0.1": etapa + major.minor, para mostrar sin ruido. */
export const ETIQUETA_VERSION = `${ETAPA[0].toUpperCase()}${ETAPA.slice(1)} ${VERSION.split('.').slice(0, 2).join('.')}`
