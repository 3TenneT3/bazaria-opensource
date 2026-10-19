import { getFotoLocal } from '@/data'
import type { Prenda } from '@/domain/types'

function extension(tipoMime: string): string {
  if (tipoMime.includes('webp')) return 'webp'
  if (tipoMime.includes('png')) return 'png'
  if (tipoMime.includes('svg')) return 'svg'
  return 'jpg'
}

function nombreArchivo(prenda: Prenda, tipoMime: string): string {
  const base = (prenda.tipo ?? 'foto')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
  return `bazaria-${base || 'foto'}-${prenda.id.slice(0, 8)}.${extension(tipoMime)}`
}

/** La foto en su mejor versión disponible: la guardada en el dispositivo o la del servidor (1024 px). */
export async function obtenerBlobFoto(prenda: Prenda): Promise<Blob> {
  const local = await getFotoLocal(prenda.id)
  if (local && local.size > 0) return local
  const url = prenda.fotoUrl.replace(/^(\/demo\/prenda-.*)\.svg$/, '$1.webp')
  const r = await fetch(url, { mode: 'cors' })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const blob = await r.blob()
  // El servidor hoy manda las .webp como text/plain: sin esto el teléfono no la reconoce como
  // imagen al compartir y se guarda con la extensión equivocada.
  if (!blob.type.startsWith('image/')) {
    const tipo = url.endsWith('.svg') ? 'image/svg+xml' : url.endsWith('.png') ? 'image/png' : 'image/webp'
    return new Blob([blob], { type: tipo })
  }
  return blob
}

/**
 * Descarga la foto de una prenda.
 * En el teléfono abre el menú de compartir (ahí está "Guardar imagen", que la manda a la
 * galería); en computadora la baja como archivo.
 */
export async function descargarFoto(prenda: Prenda): Promise<'compartida' | 'descargada'> {
  const blob = await obtenerBlobFoto(prenda)
  const nombre = nombreArchivo(prenda, blob.type)
  const archivo = new File([blob], nombre, { type: blob.type || 'image/webp' })

  if (navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo] })
      return 'compartida'
    } catch (e) {
      // Si la usuaria cierra el menú no es un error; cualquier otro fallo cae a la descarga.
      if (e instanceof DOMException && e.name === 'AbortError') return 'compartida'
    }
  }

  const url = URL.createObjectURL(archivo)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'descargada'
}
