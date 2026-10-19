import { describe, it, expect } from 'vitest'
import { DemoDataSource } from './DemoDataSource'
import { almacenDemo } from './db'
import { DIAS_EN_PAPELERA, diasRestantes, venceYa } from '@/domain/papelera'

const DIA = 24 * 60 * 60 * 1000

describe('papelera: días', () => {
  const ahora = Date.parse('2026-10-19T12:00:00Z')
  const descartadaHace = (dias: number) => ({
    status: 'descartada' as const,
    descartadaEn: new Date(ahora - dias * DIA).toISOString(),
  })

  it('cuenta los días que le quedan', () => {
    expect(diasRestantes(descartadaHace(0), ahora)).toBe(DIAS_EN_PAPELERA)
    expect(diasRestantes(descartadaHace(29.5), ahora)).toBe(1)
    expect(diasRestantes(descartadaHace(40), ahora)).toBe(0)
  })

  it('solo vence a los 30 días cumplidos', () => {
    expect(venceYa(descartadaHace(29), ahora)).toBe(false)
    expect(venceYa(descartadaHace(30), ahora)).toBe(true)
  })

  it('lo que no está en la papelera (o no tiene fecha) nunca vence', () => {
    expect(diasRestantes({ status: 'disponible', descartadaEn: null }, ahora)).toBeNull()
    expect(venceYa({ status: 'descartada', descartadaEn: null }, ahora)).toBe(false)
  })
})

describe('papelera: DemoDataSource', () => {
  async function nuevaPrendaDescartada(ds: DemoDataSource) {
    const [prenda] = (await ds.listarPrendas()).filter((p) => p.status === 'disponible')
    await ds.cambiarStatus(prenda.id, 'descartada')
    return prenda
  }

  it('descartar anota la fecha y restaurar la limpia', async () => {
    const ds = new DemoDataSource()
    const [prenda] = (await ds.listarPrendas()).filter((p) => p.status === 'disponible')
    expect((await ds.cambiarStatus(prenda.id, 'descartada')).descartadaEn).toBeTruthy()
    expect((await ds.cambiarStatus(prenda.id, 'disponible')).descartadaEn).toBeNull()
  })

  it('no borra una prenda que no está en la papelera', async () => {
    const ds = new DemoDataSource()
    const [prenda] = (await ds.listarPrendas()).filter((p) => p.status === 'disponible')
    await expect(ds.eliminarPrenda(prenda.id)).rejects.toThrow(/papelera/)
    expect(await ds.obtenerPrenda(prenda.id)).not.toBeNull()
  })

  it('borra definitivo desde la papelera, con su foto, y repetirlo no falla', async () => {
    const ds = new DemoDataSource()
    const prenda = await nuevaPrendaDescartada(ds)
    await ds.eliminarPrenda(prenda.id)
    expect(await ds.obtenerPrenda(prenda.id)).toBeNull()
    expect(await almacenDemo.getFoto(prenda.id)).toBeUndefined()
    await expect(ds.eliminarPrenda(prenda.id)).resolves.toBeUndefined()
  })

  it('la papelera se vacía sola a los 30 días', async () => {
    const ds = new DemoDataSource()
    const vieja = await nuevaPrendaDescartada(ds)
    const reciente = await nuevaPrendaDescartada(ds)
    const guardada = await almacenDemo.get('prendas', vieja.id)
    await almacenDemo.put('prendas', { ...guardada!, descartadaEn: new Date(Date.now() - 31 * DIA).toISOString() })

    const ids = (await ds.listarPrendas()).map((p) => p.id)
    expect(ids).not.toContain(vieja.id)
    expect(ids).toContain(reciente.id)
  })
})
