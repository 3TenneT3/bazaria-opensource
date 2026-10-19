import type { Prenda, Venta } from './types'

/**
 * Calcula el prorrateo de costo para las prendas de un lote.
 * costo unitario = costoTotal / (piezasCompradas - piezasDescartadas)
 * Las prendas con costoManual=true se excluyen: su costo se resta del total
 * antes de prorratear, y conservan su costo propio.
 * El residuo de centavos (por redondeo) se asigna a la ÚLTIMA prenda prorrateada
 * (en el orden del arreglo de entrada) para que la suma cuadre exacto.
 *
 * `prendasDelLote` debe incluir SOLO las prendas vigentes del lote (no descartadas
 * a nivel de inventario, salvo que quieras recalcular incluyéndolas explícitamente;
 * normalmente se excluyen antes de llamar esta función).
 */
export function prorratearLote(
  costoTotal: number,
  piezasCompradas: number,
  piezasDescartadas: number,
  prendasDelLote: Prenda[],
): Prenda[] {
  const piezasValidas = piezasCompradas - piezasDescartadas
  if (piezasValidas <= 0) {
    throw new Error('El número de piezas válidas debe ser mayor a 0')
  }

  const prendasManuales = prendasDelLote.filter((p) => p.costoManual)
  const prendasAProrratear = prendasDelLote.filter((p) => !p.costoManual)

  const costoManualTotal = prendasManuales.reduce((acc, p) => acc + p.costo, 0)
  const costoAProrratear = costoTotal - costoManualTotal

  if (prendasAProrratear.length === 0) {
    return prendasDelLote
  }

  // El divisor es el número de PIEZAS REALES del lote (no cuántas ya se dieron
  // de alta en el inventario digital). Esto permite registrar solo una parte
  // de un lote grande (p. ej. un demo con 18 de 56 piezas) sin que esas pocas
  // prendas absorban el costo de TODO el lote: cada una recibe el costo
  // unitario real, aunque el resto de las piezas aún no tenga su propio
  // registro. Cuando se registran todas las piezas válidas, el resultado es
  // idéntico al de dividir entre la longitud del arreglo.
  const piezasAProrratear = piezasValidas - prendasManuales.length
  const costoBaseUnitario = Math.floor(costoAProrratear / piezasAProrratear)
  const residuo = costoAProrratear - costoBaseUnitario * piezasAProrratear

  const resultado = new Map<string, Prenda>()
  for (const p of prendasDelLote) {
    resultado.set(p.id, p)
  }

  prendasAProrratear.forEach((p, idx) => {
    const esUltima = idx === prendasAProrratear.length - 1
    const costo = costoBaseUnitario + (esUltima ? residuo : 0)
    resultado.set(p.id, { ...p, costo })
  })

  return prendasDelLote.map((p) => resultado.get(p.id)!)
}

/** Ganancia por venta = precioFinal - costo - costoEnvio - comision. */
export function gananciaVenta(
  precioFinal: number,
  costo: number,
  costoEnvio: number,
  comision: number,
): number {
  return precioFinal - costo - costoEnvio - comision
}

/** Lo que de verdad entró por una venta: precio final menos lo reembolsado en una devolución. */
export function ingresoVenta(venta: Pick<Venta, 'precioFinal' | 'reembolso'>): number {
  return venta.precioFinal - (venta.reembolso ?? 0)
}

/** El costo de la prenda cuenta en la venta salvo que haya vuelto al inventario (contará al revenderla). */
export function costoDePrendaEnVenta(venta: Pick<Venta, 'destinoDevolucion'>, costoPrenda: number): number {
  return venta.destinoDevolucion === 'disponible' ? 0 : costoPrenda
}

/** Ganancia real de una venta, ya con su devolución (si la hubo). Envío y comisión siempre cuentan. */
export function gananciaDeVenta(venta: Venta, costoPrenda: number): number {
  return gananciaVenta(ingresoVenta(venta), costoDePrendaEnVenta(venta, costoPrenda), venta.costoEnvio, venta.comision)
}

/** ¿La venta sigue contando como prenda vendida? (no si la prenda regresó). */
export function cuentaComoVendida(venta: Pick<Venta, 'destinoDevolucion'>): boolean {
  return !venta.destinoDevolucion || venta.destinoDevolucion === 'cliente'
}

/** Capital parado = suma del costo de las prendas con status disponible o apartada. */
export function capitalParado(prendas: Prenda[]): number {
  return prendas
    .filter((p) => p.status === 'disponible' || p.status === 'apartada')
    .reduce((acc, p) => acc + p.costo, 0)
}

/** Recuperación de lote: recuperado = suma de precioFinal de las ventas del lote;
 *  faltante = costoTotal - recuperado (mínimo 0). */
export function recuperacionLote(
  costoTotalLote: number,
  precioFinalVentasDelLote: number[],
): { recuperado: number; faltante: number } {
  const recuperado = precioFinalVentasDelLote.reduce((acc, v) => acc + v, 0)
  const faltante = Math.max(0, costoTotalLote - recuperado)
  return { recuperado, faltante }
}

/** Rotación = días promedio entre el alta de una prenda y su venta. */
export function rotacionPromedioDias(
  pares: { creadoEn: string; fechaVenta: string }[],
): number {
  if (pares.length === 0) return 0
  const totalDias = pares.reduce((acc, par) => {
    const creado = new Date(par.creadoEn).getTime()
    const vendido = new Date(par.fechaVenta).getTime()
    const dias = (vendido - creado) / (1000 * 60 * 60 * 24)
    return acc + dias
  }, 0)
  return totalDias / pares.length
}
