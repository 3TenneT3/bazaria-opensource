import { describe, it, expect } from 'vitest'
import { prorratearLote, gananciaVenta, capitalParado, recuperacionLote, rotacionPromedioDias } from './costos'
import type { Prenda } from './types'

function mkPrenda(overrides: Partial<Prenda> = {}): Prenda {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    loteId: 'lote-1',
    fotoUrl: 'blob://x',
    tipo: 'blusa',
    color: 'azul',
    talla: 'M',
    marca: null,
    estado: 'usada',
    costo: 0,
    costoManual: false,
    precioVenta: 10000,
    status: 'disponible',
    creadoEn: new Date().toISOString(),
    ...overrides,
  }
}

describe('prorratearLote', () => {
  it('paca normal: reparte el costo total entre todas las piezas por igual', () => {
    const prendas = Array.from({ length: 4 }, (_, i) => mkPrenda({ id: `p${i}` }))
    const resultado = prorratearLote(40000, 4, 0, prendas)
    // 40000 / 4 = 10000 exacto
    expect(resultado.every((p) => p.costo === 10000)).toBe(true)
    expect(resultado.reduce((acc, p) => acc + p.costo, 0)).toBe(40000)
  })

  it('paca con descartes: las piezas descartadas no entran al prorrateo', () => {
    // 60 piezas compradas, 4 descartadas => 56 piezas válidas en el lote
    const prendas = Array.from({ length: 56 }, (_, i) => mkPrenda({ id: `p${i}` }))
    const resultado = prorratearLote(350000, 60, 4, prendas)
    const total = resultado.reduce((acc, p) => acc + p.costo, 0)
    expect(total).toBe(350000)
    // Costo base: floor(350000/56) = 6250, exacto en este caso
    expect(resultado[0].costo).toBe(6250)
  })

  it('mezcla con costo manual: las prendas manuales no se recalculan y su costo se resta antes de prorratear', () => {
    const manual = mkPrenda({ id: 'manual-1', costoManual: true, costo: 5000 })
    const normales = Array.from({ length: 3 }, (_, i) => mkPrenda({ id: `n${i}` }))
    const prendas = [manual, ...normales]
    const resultado = prorratearLote(20000, 4, 0, prendas)

    const prendaManual = resultado.find((p) => p.id === 'manual-1')!
    expect(prendaManual.costo).toBe(5000) // sin cambios

    const restantes = resultado.filter((p) => p.id !== 'manual-1')
    // (20000 - 5000) / 3 = 5000 exacto
    expect(restantes.every((p) => p.costo === 5000)).toBe(true)
    expect(resultado.reduce((acc, p) => acc + p.costo, 0)).toBe(20000)
  })

  it('residuo de centavos: el residuo se asigna a la última prenda para que la suma cuadre exacto', () => {
    const prendas = Array.from({ length: 3 }, (_, i) => mkPrenda({ id: `p${i}` }))
    // 10000 / 3 = 3333.33 => base 3333, residuo 1
    const resultado = prorratearLote(10000, 3, 0, prendas)
    expect(resultado[0].costo).toBe(3333)
    expect(resultado[1].costo).toBe(3333)
    expect(resultado[2].costo).toBe(3334) // última prenda se lleva el residuo
    expect(resultado.reduce((acc, p) => acc + p.costo, 0)).toBe(10000)
  })

  it('lanza error si las piezas válidas son 0 o negativas', () => {
    expect(() => prorratearLote(10000, 2, 2, [])).toThrow()
  })
})

describe('gananciaVenta', () => {
  it('venta con envío y comisión: resta todos los componentes', () => {
    // precioFinal=20000, costo=8000, envio=1500, comision=2000 => ganancia=8500
    expect(gananciaVenta(20000, 8000, 1500, 2000)).toBe(8500)
  })

  it('ganancia sin envío ni comisión', () => {
    expect(gananciaVenta(10000, 4000, 0, 0)).toBe(6000)
  })
})

describe('capitalParado', () => {
  it('suma solo prendas disponibles o apartadas', () => {
    const prendas = [
      mkPrenda({ costo: 1000, status: 'disponible' }),
      mkPrenda({ costo: 2000, status: 'apartada' }),
      mkPrenda({ costo: 3000, status: 'vendida' }),
      mkPrenda({ costo: 4000, status: 'descartada' }),
    ]
    expect(capitalParado(prendas)).toBe(3000)
  })
})

describe('recuperacionLote', () => {
  it('calcula recuperado y faltante normalmente', () => {
    const { recuperado, faltante } = recuperacionLote(10000, [3000, 2000])
    expect(recuperado).toBe(5000)
    expect(faltante).toBe(5000)
  })

  it('lote recuperado de más: el faltante nunca es negativo', () => {
    const { recuperado, faltante } = recuperacionLote(10000, [8000, 5000])
    expect(recuperado).toBe(13000)
    expect(faltante).toBe(0)
  })
})

describe('rotacionPromedioDias', () => {
  it('calcula el promedio de días entre alta y venta', () => {
    const pares = [
      { creadoEn: '2024-01-01T00:00:00.000Z', fechaVenta: '2024-01-11T00:00:00.000Z' }, // 10 días
      { creadoEn: '2024-01-01T00:00:00.000Z', fechaVenta: '2024-01-21T00:00:00.000Z' }, // 20 días
    ]
    expect(rotacionPromedioDias(pares)).toBe(15)
  })

  it('devuelve 0 si no hay pares', () => {
    expect(rotacionPromedioDias([])).toBe(0)
  })
})
