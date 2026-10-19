import * as XLSX from 'xlsx'
import type { Prenda, Venta } from '@/domain/types'
import { formatearFecha } from '@/lib/fechas'

/** Exporta Inventario y Ventas a un archivo Excel con dos hojas. */
export function exportarExcel(prendas: Prenda[], ventas: Venta[]): void {
  const prendaPorId = new Map(prendas.map((p) => [p.id, p]))

  const hojaInventario = XLSX.utils.json_to_sheet(
    prendas.map((p) => ({
      Tipo: p.tipo ?? '',
      Color: p.color ?? '',
      'Talla o medida': p.talla ?? '',
      Marca: p.marca ?? '',
      Estado: p.estado,
      'Lo que costó': (p.costo / 100).toFixed(2),
      'En cuánto se da': (p.precioVenta / 100).toFixed(2),
      Status: p.status,
      Agregada: formatearFecha(p.creadoEn),
    })),
  )

  const hojaVentas = XLSX.utils.json_to_sheet(
    ventas.map((v) => {
      const prenda = prendaPorId.get(v.prendaId)
      const ganancia = v.precioFinal - (prenda?.costo ?? 0) - v.costoEnvio - v.comision
      return {
        'Prenda o artículo': prenda?.tipo ?? 'Desconocida',
        'Precio final': (v.precioFinal / 100).toFixed(2),
        Envío: (v.costoEnvio / 100).toFixed(2),
        Comisión: (v.comision / 100).toFixed(2),
        Ganancia: (ganancia / 100).toFixed(2),
        Canal: v.canal,
        Fecha: formatearFecha(v.fechaVenta),
      }
    }),
  )

  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hojaInventario, 'Inventario')
  XLSX.utils.book_append_sheet(libro, hojaVentas, 'Ventas')

  const fecha = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(libro, `bazaria-${fecha}.xlsx`)
}
