import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { leerInventario } from './importarExportar'

function archivo(filas: Record<string, string | number>[]): File {
  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filas), 'Inventario')
  const datos = XLSX.write(libro, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  const f = new File([datos], 'inventario.xlsx')
  // jsdom no siempre trae File.arrayBuffer
  if (!f.arrayBuffer) Object.defineProperty(f, 'arrayBuffer', { value: async () => datos })
  return f
}

describe('leerInventario', () => {
  it('lee la columna nueva "Talla o medida"', async () => {
    const { prendas, errores } = await leerInventario(
      archivo([{ Tipo: 'taza', 'Talla o medida': '350 ml', Estado: 'nueva', Costo: 20, 'Precio de venta': 60 }]),
    )
    expect(errores).toEqual([])
    expect(prendas[0].talla).toBe('350 ml')
  })

  it('sigue aceptando plantillas viejas con "Talla"', async () => {
    const { prendas, errores } = await leerInventario(
      archivo([{ Tipo: 'blusa', Talla: 'M', Estado: 'usada', Costo: 25, 'Precio de venta': 80 }]),
    )
    expect(errores).toEqual([])
    expect(prendas[0].talla).toBe('M')
  })
})
