import type { StatusPrenda } from '@/domain/types'
import type { CrearLoteInput, CrearPrendaInput, RegistrarDevolucionInput, RegistrarVentaInput } from '../DataSource'

/**
 * Un cambio hecho en este dispositivo que todavía no llega al servidor.
 * Los ids los genera el cliente (UUID): así el servidor puede recibir el mismo cambio dos veces
 * (se perdió la respuesta) sin duplicarlo, y una venta puede apuntar a una prenda que aún no sube.
 */
export type Operacion =
  | { tipo: 'crearLote'; id: string; data: CrearLoteInput }
  | { tipo: 'actualizarLote'; id: string; data: Partial<CrearLoteInput> }
  | { tipo: 'eliminarLote'; id: string }
  | { tipo: 'crearPrenda'; id: string; data: CrearPrendaInput; creadoEn: string }
  | { tipo: 'actualizarPrenda'; id: string; data: Partial<CrearPrendaInput> }
  | { tipo: 'cambiarStatus'; id: string; status: StatusPrenda }
  | { tipo: 'eliminarPrenda'; id: string }
  | { tipo: 'registrarVenta'; id: string; prendaId: string; data: RegistrarVentaInput; fechaVenta: string }
  | { tipo: 'deshacerVenta'; id: string }
  | { tipo: 'registrarDevolucion'; id: string; prendaId: string; data: RegistrarDevolucionInput; fecha: string }

export interface OperacionPendiente {
  /** Clave ordenable (orden de captura). */
  id: string
  creadoEn: string
  intentos: number
  op: Operacion
  /** Veces seguidas que el servidor respondió 5xx a este cambio. */
  fallosServidor?: number
  /**
   * El servidor falla con este cambio una y otra vez: se mandó al final de la cola para no
   * bloquear los demás. Se sigue reintentando y nunca se borra solo.
   */
  atorada?: boolean
}

/** Sin red, sin respuesta a tiempo o error 5xx del servidor: se reintenta más tarde. */
export class ErrorRed extends Error {
  constructor(mensaje = 'Error de red. Revisa tu conexión e intenta de nuevo.') {
    super(mensaje)
    this.name = 'ErrorRed'
  }
}

/** El servidor respondió con error 5xx. Puede ser pasajero (reinicio) o un fallo con ese cambio. */
export class ErrorServidor extends ErrorRed {
  readonly status: number

  constructor(status: number) {
    super(`El servidor no respondió bien (${status}). Intenta de nuevo.`)
    this.name = 'ErrorServidor'
    this.status = status
  }
}

/** El servidor respondió y rechazó el cambio (4xx). Reintentar no lo arregla. */
export class ErrorApi extends Error {
  readonly status: number
  readonly codigo?: string

  constructor(mensaje: string, status: number, codigo?: string) {
    super(mensaje)
    this.name = 'ErrorApi'
    this.status = status
    this.codigo = codigo
  }
}
