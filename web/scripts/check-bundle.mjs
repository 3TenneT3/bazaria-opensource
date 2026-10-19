// Falla si el build de demo (/dist) contiene "VITE_API_URL" con valor real
// o patrones que parezcan API keys/secretos. El build de demo NO debe llevar
// URLs de API ni secretos — es una demo 100% estática sin backend.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DIST_DIR = 'dist'

const PATRONES_SOSPECHOSOS = [
  /VITE_API_URL\s*[:=]\s*["']https?:\/\//i, // VITE_API_URL con valor de URL real
  /sk-[a-zA-Z0-9]{20,}/, // patrón típico de API key (OpenAI-like)
  /AIza[0-9A-Za-z-_]{35}/, // patrón de API key de Google
  /(?:api[_-]?key|secret|token)["']?\s*[:=]\s*["'][a-zA-Z0-9_-]{20,}["']/i,
]

function listarArchivos(dir) {
  const resultado = []
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre)
    const stat = statSync(ruta)
    if (stat.isDirectory()) {
      resultado.push(...listarArchivos(ruta))
    } else if (/\.(js|html|css|json)$/.test(nombre)) {
      resultado.push(ruta)
    }
  }
  return resultado
}

let encontrados = []

try {
  const archivos = listarArchivos(DIST_DIR)
  for (const archivo of archivos) {
    const contenido = readFileSync(archivo, 'utf-8')
    for (const patron of PATRONES_SOSPECHOSOS) {
      if (patron.test(contenido)) {
        encontrados.push({ archivo, patron: patron.toString() })
      }
    }
  }
} catch (err) {
  console.error(`No se pudo leer el directorio ${DIST_DIR}. ¿Corriste "npm run build:demo" antes?`)
  console.error(err.message)
  process.exit(1)
}

if (encontrados.length > 0) {
  console.error('❌ Se encontraron posibles URLs de API o secretos en el build de demo:')
  for (const { archivo, patron } of encontrados) {
    console.error(`  - ${archivo} coincide con ${patron}`)
  }
  process.exit(1)
}

console.log('✅ check:bundle OK — no se encontraron URLs de API ni secretos en /dist')
