import { useSyncExternalStore } from 'react'

/** Lo que la interfaz necesita saber de la sincronización (modo api). */
export interface EstadoSync {
  /** Cambios guardados en este dispositivo que aún no suben al servidor. */
  pendientes: number
  sincronizando: boolean
  /** El último intento de hablar con el servidor falló por red (o el navegador dice que no hay conexión). */
  sinConexion: boolean
  /** Sube cuando llegan datos distintos del servidor: las pantallas vuelven a leer. */
  version: number
  /** Cambios que el servidor no logra procesar (5xx repetido). Siguen guardados y se reintentan. */
  atorados: number
  /** Cambios que el servidor rechazó (ya se descartaron); se muestran una vez. */
  avisos: string[]
}

const INICIAL: EstadoSync = { pendientes: 0, atorados: 0, sincronizando: false, sinConexion: false, version: 0, avisos: [] }

let estado: EstadoSync = INICIAL
const oyentes = new Set<() => void>()

export function leerEstado(): EstadoSync {
  return estado
}

export function actualizarEstado(parcial: Partial<EstadoSync>): void {
  estado = { ...estado, ...parcial }
  oyentes.forEach((f) => f())
}

export function descartarAvisos(): void {
  actualizarEstado({ avisos: [] })
}

function suscribir(f: () => void): () => void {
  oyentes.add(f)
  return () => oyentes.delete(f)
}

export function useEstadoSync(): EstadoSync {
  return useSyncExternalStore(suscribir, leerEstado, () => INICIAL)
}

/** Solo para pruebas. */
export function reiniciarEstado(): void {
  estado = INICIAL
}
