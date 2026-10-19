import type { DataSource } from './DataSource'
import { DemoDataSource } from './DemoDataSource'
import { ApiDataSource } from './ApiDataSource'
import { OfflineDataSource } from './OfflineDataSource'
import { getFoto as getFotoDemo } from './db'

const modo = import.meta.env.VITE_MODE ?? 'demo'
const apiUrl = import.meta.env.VITE_API_URL ?? ''

let instancia: DataSource | null = null

/** Elige la implementación de DataSource según VITE_MODE (demo|api). */
export function getDataSource(): DataSource {
  if (!instancia) {
    // En modo api la app es "primero local": lee y escribe en el dispositivo y sincroniza con el servidor.
    instancia = modo === 'api' ? new OfflineDataSource(new ApiDataSource(apiUrl)) : new DemoDataSource()
  }
  return instancia
}

export const esModoDemo = modo !== 'api'

/**
 * ¿Ofrecer reconocimiento de prendas por foto? En demo es simulado. En api lo decide
 * el servidor por usuaria (plan premium + IA conectada) vía /auth/me. Sin esto, cada
 * foto se subía dos veces, hacía esperar y mostraba "No pudimos reconocer".
 */
export async function iaDisponible(): Promise<boolean> {
  if (esModoDemo) return true
  const u = await getDataSource().usuariaActual()
  return !!u?.iaDisponible
}

/** Foto de una prenda guardada en este dispositivo (para prendas aún sin subir o si falla la URL). */
export function getFotoLocal(id: string): Promise<Blob | undefined> {
  const ds = getDataSource()
  return ds instanceof OfflineDataSource ? ds.fotoLocal(id) : getFotoDemo(id)
}

export type {
  DataSource,
  Usuaria,
  FiltrosPrendas,
  CrearLoteInput,
  CrearPrendaInput,
  RegistrarVentaInput,
  RangoFechas,
} from './DataSource'
