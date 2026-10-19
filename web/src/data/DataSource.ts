import type {
  Lote,
  Prenda,
  Venta,
  AnalisisVision,
  ResumenMes,
  ResumenLote,
  StatusPrenda,
  DestinoDevolucion,
} from '@/domain/types'

export interface Usuaria {
  email: string
  /** Solo en modo api. 'premium' habilita funciones de pago cuando estén conectadas. */
  plan?: 'gratis' | 'premium'
  /** El servidor dice si para esta cuenta hay reconocimiento de prendas por foto. */
  iaDisponible?: boolean
  /** Solo en modo api: espacio de fotos usado y el límite del plan, en bytes. */
  fotosBytesUsados?: number
  fotosBytesCuota?: number
}

export interface FiltrosPrendas {
  status?: StatusPrenda
  tipo?: string
  talla?: string
  loteId?: string | null
  texto?: string
}

export interface CrearLoteInput {
  nombre: string
  costoTotal: number
  piezasCompradas: number
  piezasDescartadas: number
  fechaCompra: string
  notas: string | null
}

export interface CrearPrendaInput {
  loteId: string | null
  tipo: string | null
  color: string | null
  talla: string | null
  marca: string | null
  estado: Prenda['estado']
  costo: number
  costoManual: boolean
  precioVenta: number
}

export interface RegistrarVentaInput {
  precioFinal: number
  costoEnvio: number
  comision: number
  canal: Venta['canal']
}

/** Devolución de una venta: cuánto se le regresó a la clienta (centavos) y qué pasa con la prenda. */
export interface RegistrarDevolucionInput {
  reembolso: number
  destino: DestinoDevolucion
}

export interface ResultadoLiberarFotos {
  liberados: number
  bytesLiberados: number
}

export interface RangoFechas {
  desde: string
  hasta: string
}

/**
 * Interfaz única de acceso a datos. Ningún componente debe usar IndexedDB o
 * fetch directamente: todo pasa por esta interfaz, implementada por
 * DemoDataSource (modo demo, IndexedDB local) o ApiDataSource (modo api, backend real).
 */
export interface DataSource {
  // Auth
  logout(): Promise<void>
  /** Cierra la sesión en TODOS los dispositivos (teléfono perdido o prestado), incluido este. */
  cerrarSesionEnTodos(): Promise<void>
  /** Pide borrar la cuenta y sus datos. Cierra la sesión local al terminar. */
  eliminarCuenta(): Promise<void>
  usuariaActual(): Promise<Usuaria | null>

  // Lotes
  listarLotes(): Promise<Lote[]>
  crearLote(data: CrearLoteInput): Promise<Lote>
  actualizarLote(id: string, data: Partial<CrearLoteInput>): Promise<Lote>
  eliminarLote(id: string): Promise<void>

  // Prendas
  listarPrendas(filtros?: FiltrosPrendas): Promise<Prenda[]>
  obtenerPrenda(id: string): Promise<Prenda | null>
  crearPrenda(data: CrearPrendaInput, foto: Blob): Promise<Prenda>
  actualizarPrenda(id: string, data: Partial<CrearPrendaInput>): Promise<Prenda>
  cambiarStatus(id: string, status: StatusPrenda): Promise<Prenda>
  /** Borrado definitivo (libera la foto). Solo prendas que están en la papelera (descartadas). */
  eliminarPrenda(id: string): Promise<void>
  /**
   * Quita la foto grande de prendas VENDIDAS y deja la miniatura, para liberar espacio. Sin `ids`: todas las
   * vendidas. Solo con cuenta (es una acción del servidor) y siempre a pedido de la usuaria.
   */
  liberarFotos(ids?: string[]): Promise<ResultadoLiberarFotos>

  // Ventas
  registrarVenta(prendaId: string, data: RegistrarVentaInput): Promise<Venta>
  listarVentas(rango?: RangoFechas): Promise<Venta[]>
  deshacerVenta(ventaId: string): Promise<void>
  /** Devolución total o parcial. La venta se conserva; la prenda vuelve, va a la papelera o se queda con la clienta. */
  registrarDevolucion(ventaId: string, data: RegistrarDevolucionInput): Promise<Venta>

  // IA
  analizarFoto(foto: Blob): Promise<AnalisisVision | null>

  // Reportes
  resumenMes(anio: number, mes: number): Promise<ResumenMes>
  resumenLote(loteId: string): Promise<ResumenLote>
}
