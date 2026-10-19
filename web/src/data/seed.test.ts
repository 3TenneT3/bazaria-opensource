import { describe, it, expect } from 'vitest'
import { generarSemilla } from './seed'
import { resumenMes } from '@/domain/resumen'

// Vite indexa los SVG reales de /public/demo vía import.meta.glob sobre /src
// no alcanza /public directamente, así que se listan a mano los 25 archivos
// que created-seed-assets.py generó (prenda-01 a prenda-25). Si se agregan o
// quitan assets de /public/demo, actualizar esta lista junto con el script.
const TIPOS_POR_INDICE = ['blusa', 'pantalon', 'vestido', 'falda', 'chamarra']
const archivosDemoReales = new Set(
  Array.from({ length: 25 }, (_, i) => {
    const numero = i + 1
    const tipo = TIPOS_POR_INDICE[i % TIPOS_POR_INDICE.length]
    return `/demo/prenda-${String(numero).padStart(2, '0')}-${tipo}.webp`
  }),
)

describe('generarSemilla', () => {
  it('cada fotoUrl apunta a un archivo que realmente existe en /public/demo', () => {
    const { prendas } = generarSemilla()
    const faltantes = prendas
      .map((p) => p.fotoUrl)
      .filter((url) => !archivosDemoReales.has(url))
    expect(faltantes).toEqual([])
  })

  it('genera 2 lotes y 25 prendas', () => {
    const { lotes, prendas } = generarSemilla()
    expect(lotes).toHaveLength(2)
    expect(prendas).toHaveLength(25)
  })

  it('la ganancia neta del mes actual de las ventas generadas nunca es negativa', () => {
    const { ventas, prendas } = generarSemilla()
    const ahora = new Date()
    const resumen = resumenMes(ahora.getFullYear(), ahora.getMonth() + 1, ventas, prendas, ahora)
    expect(resumen.gananciaNeta).toBeGreaterThanOrEqual(0)
  })
})
