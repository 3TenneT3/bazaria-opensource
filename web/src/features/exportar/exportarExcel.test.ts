import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import type { Prenda, Venta } from '@/domain/types'
import { FORMATO_FECHA, FORMATO_MONEDA, hojaConFormato } from '@/lib/excel'
import { libroResumen } from './exportarExcel'

const prenda = {
  id: 'p1',
  tipo: 'blusa',
  color: 'lila',
  talla: 'M',
  marca: 'Zara',
  estado: 'seminueva',
  costo: 2550,
  precioVenta: 12050,
  status: 'vendida',
  creadoEn: '2026-10-05T15:00:00.000Z',
} as unknown as Prenda

const venta = {
  id: 'v1',
  prendaId: 'p1',
  precioFinal: 120000, // $1,200.00: comprueba el separador de miles
  costoEnvio: 5000,
  comision: 1000,
  canal: 'marketplace',
  fechaVenta: '2026-10-19T12:00:00.000Z',
} as unknown as Venta

/** Escribe el libro a bytes y lo vuelve a leer, como lo abriría Excel. */
function releer(libro: XLSX.WorkBook): XLSX.WorkBook {
  const bytes = XLSX.write(libro, { type: 'array', bookType: 'xlsx' })
  return XLSX.read(bytes, { type: 'array', cellNF: true, cellDates: true })
}

function celda(hoja: XLSX.WorkSheet, encabezado: string, fila = 1): XLSX.CellObject {
  const rango = XLSX.utils.decode_range(hoja['!ref'] as string)
  for (let c = rango.s.c; c <= rango.e.c; c++) {
    if (hoja[XLSX.utils.encode_cell({ r: 0, c })]?.v === encabezado) return hoja[XLSX.utils.encode_cell({ r: fila, c })]
  }
  throw new Error(`No existe la columna ${encabezado}`)
}

describe('Excel exportado', () => {
  it('el dinero sale como número con formato de pesos (se puede sumar)', () => {
    const libro = releer(libroResumen([prenda], [venta]))
    const inv = libro.Sheets['Inventario']
    expect(celda(inv, 'Lo que costó')).toMatchObject({ t: 'n', v: 25.5, z: FORMATO_MONEDA })
    expect(celda(inv, 'En cuánto se da')).toMatchObject({ t: 'n', v: 120.5, z: FORMATO_MONEDA })

    const ventas = libro.Sheets['Ventas']
    expect(celda(ventas, 'Precio final')).toMatchObject({ t: 'n', v: 1200, z: FORMATO_MONEDA })
    expect(celda(ventas, 'Envío')).toMatchObject({ t: 'n', v: 50 })
    expect(celda(ventas, 'Comisión')).toMatchObject({ t: 'n', v: 10 })
    // 1200 - 25.50 - 50 - 10
    expect(celda(ventas, 'Ganancia')).toMatchObject({ t: 'n', v: 1114.5, z: FORMATO_MONEDA })
    expect(celda(ventas, 'Precio final').w).toBe('$1,200.00')
  })

  it('las fechas salen como fecha real de Excel (se pueden ordenar y filtrar)', () => {
    const libro = releer(libroResumen([prenda], [venta]))
    const fecha = celda(libro.Sheets['Ventas'], 'Fecha')
    expect(fecha.t).toBe('d')
    expect(fecha.z).toBe(FORMATO_FECHA)
    const d = fecha.v as Date
    const esperado = new Date('2026-10-19T12:00:00.000Z')
    // SheetJS devuelve la fecha de Excel como medianoche UTC: se compara con getUTC*, no con la zona del equipo.
    expect([d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()]).toEqual([
      esperado.getFullYear(),
      esperado.getMonth(),
      esperado.getDate(),
    ])
    expect(celda(libro.Sheets['Inventario'], 'Agregada').t).toBe('d')
  })

  it('el texto no se toca y una fecha inválida queda vacía en lugar de romper', () => {
    const hoja = hojaConFormato([{ Tipo: 'blusa', Monto: 10, Fecha: '' }], { moneda: ['Monto'], fecha: ['Fecha'] })
    expect(hoja['A2']).toMatchObject({ t: 's', v: 'blusa' })
    expect(hoja['A2'].z).toBeUndefined()
    expect(hoja['B2']).toMatchObject({ t: 'n', v: 10, z: FORMATO_MONEDA })
  })
})
