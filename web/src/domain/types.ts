// Tipos de dominio puros. Montos siempre en centavos (enteros).

export type EstadoPrenda = 'nueva' | 'seminueva' | 'usada'
export type StatusPrenda = 'disponible' | 'apartada' | 'vendida' | 'descartada'
export type CanalVenta = 'instagram' | 'whatsapp' | 'bazar' | 'otro'

export interface Lote {
  id: string
  nombre: string
  costoTotal: number // centavos
  piezasCompradas: number
  piezasDescartadas: number
  fechaCompra: string // ISO 8601
  notas: string | null
}

export interface Prenda {
  id: string
  loteId: string | null
  fotoUrl: string // versión de detalle (1024px, webp)
  fotoMiniUrl?: string // miniatura (320px, webp) para listas; el modo demo no la tiene
  tipo: string | null
  color: string | null
  talla: string | null
  marca: string | null
  estado: EstadoPrenda
  costo: number // centavos
  costoManual: boolean
  precioVenta: number // centavos
  status: StatusPrenda
  creadoEn: string // ISO 8601
  /** Cuándo entró a la papelera (status descartada); a los 30 días se borra sola. */
  descartadaEn?: string | null
  /** Solo conserva la miniatura (se le quitó la foto grande a una venta): `fotoUrl` ya apunta a ella. */
  fotoReducida?: boolean
}

export interface Venta {
  id: string
  prendaId: string
  precioFinal: number // centavos
  costoEnvio: number // centavos
  comision: number // centavos
  canal: CanalVenta
  fechaVenta: string // ISO 8601
  /** Devolución: cuándo, cuánto se reembolsó (centavos) y qué pasó con la prenda. */
  devueltaEn?: string | null
  reembolso?: number
  destinoDevolucion?: DestinoDevolucion | null
}

/** disponible = volvió al inventario · descartada = llegó dañada · cliente = se la quedó (reembolso parcial). */
export type DestinoDevolucion = 'disponible' | 'descartada' | 'cliente'

export interface AnalisisVision {
  tipo: string | null
  color: string | null
  talla: string | null
  marca: string | null
  estado: EstadoPrenda | null
  confianza: number // 0 a 1
}

export interface ResumenMes {
  anio: number
  mes: number // 1-12
  totalVentas: number // centavos
  gananciaNeta: number // centavos
  /** Desglose de lo vendido en el mes: totalVentas - costoMercancia - envios - comisiones = gananciaNeta */
  costoMercancia: number // centavos
  envios: number // centavos
  comisiones: number // centavos
  numeroPrendasVendidas: number
  topTipos: { tipo: string; ganancia: number }[] // top 3
  prendasEstancadas: Prenda[] // más de 30 días sin venderse
}

export interface ResumenLote {
  lote: Lote
  recuperado: number // centavos
  faltante: number // centavos (mínimo 0)
  costoUnitarioActual: number // centavos
}
