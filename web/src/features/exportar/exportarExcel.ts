import * as XLSX from 'xlsx'
import type { Prenda, Venta } from '@/domain/types'
import { fechaExcel, hojaConFormato, pesos } from '@/lib/excel'
import { gananciaDeVenta } from '@/domain/costos'

const MONEDA_INVENTARIO = ['Lo que costó', 'En cuánto se da']
const MONEDA_VENTAS = ['Precio final', 'Reembolso', 'Envío', 'Comisión', 'Ganancia']

/** Arma el libro con Inventario y Ventas: dinero como número en pesos y fechas reales de Excel. */
export function libroResumen(prendas: Prenda[], ventas: Venta[]): XLSX.WorkBook {
  const prendaPorId = new Map(prendas.map((p) => [p.id, p]))

  const hojaInventario = hojaConFormato(
    prendas.map((p) => ({
      Tipo: p.tipo ?? '',
      Color: p.color ?? '',
      'Talla o medida': p.talla ?? '',
      Marca: p.marca ?? '',
      Estado: p.estado,
      'Lo que costó': pesos(p.costo),
      'En cuánto se da': pesos(p.precioVenta),
      Status: p.status,
      Agregada: fechaExcel(p.creadoEn),
    })),
    { moneda: MONEDA_INVENTARIO, fecha: ['Agregada'] },
  )

  const hojaVentas = hojaConFormato(
    ventas.map((v) => {
      const prenda = prendaPorId.get(v.prendaId)
      const ganancia = gananciaDeVenta(v, prenda?.costo ?? 0)
      return {
        'Prenda o artículo': prenda?.tipo ?? 'Desconocida',
        'Precio final': pesos(v.precioFinal),
        Reembolso: pesos(v.reembolso ?? 0),
        Envío: pesos(v.costoEnvio),
        Comisión: pesos(v.comision),
        Ganancia: pesos(ganancia),
        Canal: v.canal,
        Fecha: fechaExcel(v.fechaVenta),
        Devolución: v.devueltaEn ? fechaExcel(v.devueltaEn) : '',
        'Qué pasó con la prenda': v.destinoDevolucion
          ? { disponible: 'volvió al inventario', descartada: 'llegó dañada', cliente: 'se la quedó la clienta' }[v.destinoDevolucion]
          : '',
      }
    }),
    { moneda: MONEDA_VENTAS, fecha: ['Fecha', 'Devolución'] },
  )

  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hojaInventario, 'Inventario')
  XLSX.utils.book_append_sheet(libro, hojaVentas, 'Ventas')
  return libro
}

/** Exporta Inventario y Ventas a un archivo Excel con dos hojas. */
export function exportarExcel(prendas: Prenda[], ventas: Venta[]): void {
  const fecha = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(libroResumen(prendas, ventas), `bazaria-${fecha}.xlsx`)
}
