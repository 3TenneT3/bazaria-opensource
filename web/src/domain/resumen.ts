import type { Prenda, Venta, ResumenMes } from './types'

const DIA_MS = 1000 * 60 * 60 * 24

/**
 * Resumen del mes: ventas, ganancia neta, número de prendas vendidas,
 * top 3 tipos por ganancia y prendas con más de 30 días sin venderse.
 */
export function resumenMes(
  anio: number,
  mes: number,
  ventas: Venta[],
  prendas: Prenda[],
  ahora: Date = new Date(),
): ResumenMes {
  const ventasDelMes = ventas.filter((v) => {
    const fecha = new Date(v.fechaVenta)
    return fecha.getFullYear() === anio && fecha.getMonth() + 1 === mes
  })

  const prendaPorId = new Map(prendas.map((p) => [p.id, p]))

  let totalVentas = 0
  let gananciaNeta = 0
  let costoMercancia = 0
  let envios = 0
  let comisiones = 0
  const gananciaPorTipo = new Map<string, number>()

  for (const venta of ventasDelMes) {
    const prenda = prendaPorId.get(venta.prendaId)
    if (!prenda) continue
    totalVentas += venta.precioFinal
    costoMercancia += prenda.costo
    envios += venta.costoEnvio
    comisiones += venta.comision
    const ganancia = venta.precioFinal - prenda.costo - venta.costoEnvio - venta.comision
    gananciaNeta += ganancia
    const tipo = prenda.tipo ?? 'Sin tipo'
    gananciaPorTipo.set(tipo, (gananciaPorTipo.get(tipo) ?? 0) + ganancia)
  }

  const topTipos = [...gananciaPorTipo.entries()]
    .map(([tipo, ganancia]) => ({ tipo, ganancia }))
    .sort((a, b) => b.ganancia - a.ganancia)
    .slice(0, 3)

  const prendasEstancadas = prendas.filter((p) => {
    if (p.status !== 'disponible' && p.status !== 'apartada') return false
    const dias = (ahora.getTime() - new Date(p.creadoEn).getTime()) / DIA_MS
    return dias > 30
  })

  return {
    anio,
    mes,
    totalVentas,
    gananciaNeta,
    costoMercancia,
    envios,
    comisiones,
    numeroPrendasVendidas: ventasDelMes.length,
    topTipos,
    prendasEstancadas,
  }
}
