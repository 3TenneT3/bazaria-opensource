import { describe, expect, it } from 'vitest'
import type { Prenda, Venta } from './types'
import { gananciaDeVenta, ingresoVenta } from './costos'
import { resumenMes } from './resumen'

const prenda = (id: string): Prenda =>
  ({ id, tipo: 'chamarra', costo: 10000, precioVenta: 30000, status: 'vendida', creadoEn: '2026-10-01T00:00:00Z' }) as unknown as Prenda
const venta = (id: string, extra: Partial<Venta> = {}): Venta => ({
  id,
  prendaId: id,
  precioFinal: 30000,
  costoEnvio: 5000,
  comision: 1000,
  canal: 'instagram',
  fechaVenta: '2026-10-10T12:00:00Z',
  ...extra,
})

describe('devoluciones en los cálculos', () => {
  it('ganancia por destino (costo 100, precio 300, envío 50, comisión 10)', () => {
    expect(gananciaDeVenta(venta('a'), 10000)).toBe(14000)
    expect(gananciaDeVenta(venta('a', { reembolso: 30000, destinoDevolucion: 'disponible' }), 10000)).toBe(-6000)
    expect(gananciaDeVenta(venta('a', { reembolso: 10000, destinoDevolucion: 'cliente' }), 10000)).toBe(4000)
    expect(gananciaDeVenta(venta('a', { reembolso: 30000, destinoDevolucion: 'descartada' }), 10000)).toBe(-16000)
    expect(ingresoVenta(venta('a', { reembolso: 12000 }))).toBe(18000)
  })

  it('el resumen del mes descuenta reembolsos y no cuenta como vendidas las que regresaron', () => {
    const r = resumenMes(
      2026,
      10,
      [
        venta('a'),
        venta('b', { reembolso: 30000, destinoDevolucion: 'disponible', devueltaEn: '2026-10-11T00:00:00Z' }),
        venta('c', { reembolso: 10000, destinoDevolucion: 'cliente', devueltaEn: '2026-10-11T00:00:00Z' }),
      ],
      [prenda('a'), prenda('b'), prenda('c')],
      new Date('2026-10-20T00:00:00Z'),
    )
    expect(r.totalVentas).toBe(30000 + 0 + 20000)
    expect(r.gananciaNeta).toBe(14000 - 6000 + 4000)
    expect(r.numeroPrendasVendidas).toBe(2)
  })
})
