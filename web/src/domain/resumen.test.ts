import { describe, it, expect } from 'vitest'
import { resumenMes } from './resumen'
import type { Prenda, Venta } from './types'

function mkPrenda(overrides: Partial<Prenda> = {}): Prenda {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    loteId: null,
    fotoUrl: 'blob://x',
    tipo: 'blusa',
    color: 'azul',
    talla: 'M',
    marca: null,
    estado: 'usada',
    costo: 1000,
    costoManual: false,
    precioVenta: 5000,
    status: 'disponible',
    creadoEn: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function mkVenta(overrides: Partial<Venta> = {}): Venta {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    prendaId: 'p1',
    precioFinal: 5000,
    costoEnvio: 0,
    comision: 0,
    canal: 'instagram',
    fechaVenta: '2024-03-15T00:00:00.000Z',
    ...overrides,
  }
}

describe('resumenMes', () => {
  it('calcula ventas, ganancia neta y número de prendas vendidas del mes', () => {
    const prendas = [
      mkPrenda({ id: 'p1', tipo: 'blusa', costo: 1000 }),
      mkPrenda({ id: 'p2', tipo: 'pantalon', costo: 2000 }),
    ]
    const ventas = [
      mkVenta({ id: 'v1', prendaId: 'p1', precioFinal: 5000 }),
      mkVenta({ id: 'v2', prendaId: 'p2', precioFinal: 6000, fechaVenta: '2024-02-01T00:00:00.000Z' }), // otro mes
    ]
    const resumen = resumenMes(2024, 3, ventas, prendas)
    expect(resumen.numeroPrendasVendidas).toBe(1)
    expect(resumen.totalVentas).toBe(5000)
    expect(resumen.gananciaNeta).toBe(4000) // 5000 - 1000
  })

  it('top 3 tipos por ganancia, ordenados descendente', () => {
    const prendas = [
      mkPrenda({ id: 'p1', tipo: 'blusa', costo: 1000 }),
      mkPrenda({ id: 'p2', tipo: 'pantalon', costo: 1000 }),
      mkPrenda({ id: 'p3', tipo: 'vestido', costo: 1000 }),
      mkPrenda({ id: 'p4', tipo: 'falda', costo: 1000 }),
    ]
    const ventas = [
      mkVenta({ id: 'v1', prendaId: 'p1', precioFinal: 3000 }), // ganancia 2000
      mkVenta({ id: 'v2', prendaId: 'p2', precioFinal: 9000 }), // ganancia 8000
      mkVenta({ id: 'v3', prendaId: 'p3', precioFinal: 6000 }), // ganancia 5000
      mkVenta({ id: 'v4', prendaId: 'p4', precioFinal: 1500 }), // ganancia 500
    ]
    const resumen = resumenMes(2024, 3, ventas, prendas)
    expect(resumen.topTipos).toHaveLength(3)
    expect(resumen.topTipos[0].tipo).toBe('pantalon')
    expect(resumen.topTipos[1].tipo).toBe('vestido')
    expect(resumen.topTipos[2].tipo).toBe('blusa')
  })

  it('detecta prendas con más de 30 días sin venderse', () => {
    const ahora = new Date('2024-03-15T00:00:00.000Z')
    const prendas = [
      mkPrenda({ id: 'p1', status: 'disponible', creadoEn: '2024-01-01T00:00:00.000Z' }), // 74 días
      mkPrenda({ id: 'p2', status: 'disponible', creadoEn: '2024-03-10T00:00:00.000Z' }), // 5 días
      mkPrenda({ id: 'p3', status: 'vendida', creadoEn: '2024-01-01T00:00:00.000Z' }), // vendida, no cuenta
    ]
    const resumen = resumenMes(2024, 3, [], prendas, ahora)
    expect(resumen.prendasEstancadas).toHaveLength(1)
    expect(resumen.prendasEstancadas[0].id).toBe('p1')
  })

  it('desglosa costo de mercancía, envíos y comisiones', () => {
    const prenda = { id: 'p1', loteId: null, fotoUrl: '/x', tipo: 'cartas', color: null, talla: null, marca: null,
      estado: 'nueva', costo: 20000, costoManual: true, precioVenta: 5000, status: 'vendida',
      creadoEn: '2026-10-01T12:00:00Z' } as Prenda
    const venta = { id: 'v1', prendaId: 'p1', precioFinal: 5000, costoEnvio: 2000, comision: 300,
      canal: 'whatsapp', fechaVenta: '2026-10-15T12:00:00Z' } as Venta
    const r = resumenMes(2026, 10, [venta], [prenda], new Date('2026-10-20T00:00:00Z'))
    expect(r.costoMercancia).toBe(20000)
    expect(r.envios).toBe(2000)
    expect(r.comisiones).toBe(300)
    expect(r.totalVentas - r.costoMercancia - r.envios - r.comisiones).toBe(r.gananciaNeta)
  })
})
