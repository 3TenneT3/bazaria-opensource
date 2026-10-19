import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Lote, Prenda, StatusPrenda, Venta } from '@/domain/types'
import type { CrearLoteInput, CrearPrendaInput, RegistrarVentaInput } from './DataSource'
import type { ApiDataSource } from './ApiDataSource'
import { Almacen } from './db'
import { OfflineDataSource } from './OfflineDataSource'
import { ErrorApi, ErrorRed, ErrorServidor } from './sincronizacion/tipos'
import { leerEstado, reiniciarEstado } from './sincronizacion/estado'
import type { MotorSync } from './sincronizacion/motor'

/** Servidor en memoria que se comporta como el backend: ids del cliente idempotentes, 409 si ya vendida. */
class ServidorFalso {
  enLinea = true
  perderProximaRespuesta = false
  /** Ids de prendas con las que el servidor responde 500 siempre (cambio "envenenado"). */
  fallarCon = new Set<string>()
  lotes = new Map<string, Lote>()
  prendas = new Map<string, Prenda>()
  ventas = new Map<string, Venta>()
  llamadas: string[] = []
  cuotaLlena = false

  private red(nombre: string): void {
    this.llamadas.push(nombre)
    if (!this.enLinea) throw new ErrorRed()
  }
  private respuestaPerdida(): void {
    if (this.perderProximaRespuesta) {
      this.perderProximaRespuesta = false
      throw new ErrorRed() // el servidor ya guardó, pero el cliente no se enteró
    }
  }

  tieneSesion = () => true
  usuariaActualEstricto = async () => {
    this.red('me')
    return { email: 'vendedora@correo.com' }
  }
  logout = async () => undefined
  cerrarSesionEnTodos = async () => {
    this.red('cerrarSesionEnTodos')
  }
  eliminarCuenta = async () => undefined
  analizarFoto = async () => null

  async crearLote(data: CrearLoteInput, op?: { id?: string }): Promise<Lote> {
    this.red('crearLote')
    const id = op?.id ?? crypto.randomUUID()
    if (!this.lotes.has(id)) this.lotes.set(id, { id, ...data })
    this.respuestaPerdida()
    return this.lotes.get(id)!
  }
  async actualizarLote(id: string, data: Partial<CrearLoteInput>): Promise<Lote> {
    this.red('actualizarLote')
    const l = this.lotes.get(id)
    if (!l) throw new ErrorApi('Lote no encontrado', 404)
    const nuevo = { ...l, ...data }
    this.lotes.set(id, nuevo)
    return nuevo
  }
  async eliminarLote(id: string): Promise<void> {
    this.red('eliminarLote')
    if (!this.lotes.delete(id)) throw new ErrorApi('Lote no encontrado', 404)
  }
  async crearPrenda(data: CrearPrendaInput, _foto: Blob, op?: { id?: string; fecha?: string }): Promise<Prenda> {
    this.red('crearPrenda')
    const id = op?.id ?? crypto.randomUUID()
    if (this.fallarCon.has(id)) throw new ErrorServidor(500)
    if (this.cuotaLlena) throw new ErrorApi('Llegaste al límite de espacio para fotos de tu plan (500 MB).', 413, 'CUOTA_FOTOS')
    if (!this.prendas.has(id)) {
      this.prendas.set(id, {
        id,
        fotoUrl: `https://api.test/fotos/${id}_detalle.webp`,
        fotoMiniUrl: `https://api.test/fotos/${id}_mini.webp`,
        status: 'disponible',
        creadoEn: op?.fecha ?? new Date().toISOString(),
        ...data,
      })
    }
    this.respuestaPerdida()
    return this.prendas.get(id)!
  }
  async actualizarPrenda(id: string, data: Partial<CrearPrendaInput>): Promise<Prenda> {
    this.red('actualizarPrenda')
    const p = this.prendas.get(id)
    if (!p) throw new ErrorApi('Prenda no encontrada', 404)
    const nueva = { ...p, ...data }
    this.prendas.set(id, nueva)
    return nueva
  }
  async cambiarStatus(id: string, status: StatusPrenda): Promise<Prenda> {
    this.red('cambiarStatus')
    const p = this.prendas.get(id)
    if (!p) throw new ErrorApi('Prenda no encontrada', 404)
    const nueva = { ...p, status }
    this.prendas.set(id, nueva)
    return nueva
  }
  async registrarVenta(prendaId: string, data: RegistrarVentaInput, op?: { id?: string; fecha?: string }): Promise<Venta> {
    this.red('registrarVenta')
    const id = op?.id ?? crypto.randomUUID()
    const previa = this.ventas.get(id)
    if (previa) return previa
    const p = this.prendas.get(prendaId)
    if (!p) throw new ErrorApi('Prenda no encontrada', 404)
    if (p.status === 'vendida') throw new ErrorApi('Esta prenda ya está vendida.', 409, 'YA_VENDIDA')
    const v: Venta = { id, prendaId, fechaVenta: op?.fecha ?? new Date().toISOString(), ...data }
    this.ventas.set(id, v)
    this.prendas.set(prendaId, { ...p, status: 'vendida' })
    this.respuestaPerdida()
    return v
  }
  async deshacerVenta(id: string): Promise<void> {
    this.red('deshacerVenta')
    const v = this.ventas.get(id)
    if (!v) throw new ErrorApi('Venta no encontrada', 404)
    this.ventas.delete(id)
    const p = this.prendas.get(v.prendaId)
    if (p) this.prendas.set(p.id, { ...p, status: 'disponible' })
  }
  async registrarDevolucion(id: string, data: { reembolso: number; destino: 'disponible' | 'descartada' | 'cliente' }, op?: { fecha?: string }) {
    this.red('registrarDevolucion')
    const v = this.ventas.get(id)
    if (!v) throw new ErrorApi('Venta no encontrada', 404)
    const devuelta = { ...v, devueltaEn: op?.fecha ?? new Date().toISOString(), reembolso: data.reembolso, destinoDevolucion: data.destino }
    this.ventas.set(id, devuelta)
    const p = this.prendas.get(v.prendaId)
    if (p && data.destino !== 'cliente') this.prendas.set(p.id, { ...p, status: data.destino })
    return devuelta
  }
  async listarLotes() {
    this.red('listarLotes')
    return [...this.lotes.values()]
  }
  async listarPrendas() {
    this.red('listarPrendas')
    return [...this.prendas.values()]
  }
  async listarVentas() {
    this.red('listarVentas')
    return [...this.ventas.values()]
  }
}

const LOTE: CrearLoteInput = {
  nombre: 'Paca sept',
  costoTotal: 10000,
  piezasCompradas: 2,
  piezasDescartadas: 0,
  fechaCompra: '2026-09-15T00:00:00.000Z',
  notas: null,
}
const PRENDA = (loteId: string | null): CrearPrendaInput => ({
  loteId,
  tipo: 'blusa',
  color: 'lila',
  talla: 'M',
  marca: null,
  estado: 'usada',
  costo: 0,
  costoManual: false,
  precioVenta: 15000,
})
const VENTA: RegistrarVentaInput = { precioFinal: 15000, costoEnvio: 2500, comision: 0, canal: 'instagram' }
const FOTO = () => new Blob(['x'], { type: 'image/jpeg' })

/**
 * Cada escritura dispara una sincronización en segundo plano. Antes de cambiar el estado del
 * servidor hay que esperar a que termine, o la prueba compite con ella.
 */
const reposo = () => vi.waitFor(() => expect(leerEstado().sincronizando).toBe(false))

function crear() {
  const servidor = new ServidorFalso()
  const ds = new OfflineDataSource(servidor as unknown as ApiDataSource, new Almacen(`prueba-${crypto.randomUUID()}`))
  const motor = (ds as unknown as { motor: MotorSync }).motor
  return { servidor, ds, motor }
}

describe('modo sin conexión', () => {
  beforeEach(() => {
    reiniciarEstado()
    vi.spyOn(globalThis, 'setInterval').mockReturnValue(0 as unknown as ReturnType<typeof setInterval>)
  })

  it('guarda sin red, lo muestra de inmediato y lo sube al reconectar con los mismos ids', async () => {
    const { servidor, ds, motor } = crear()
    servidor.enLinea = false

    const lote = await ds.crearLote(LOTE)
    const prenda = await ds.crearPrenda(PRENDA(lote.id), FOTO())

    // Se ve al instante aunque no haya red.
    expect((await ds.listarLotes()).map((l) => l.id)).toEqual([lote.id])
    expect((await ds.listarPrendas()).map((p) => p.id)).toEqual([prenda.id])
    expect(servidor.lotes.size).toBe(0)
    await reposo()
    expect(leerEstado().pendientes).toBe(2)

    servidor.enLinea = true
    expect(await motor.sincronizar()).toBe('vacia')

    expect([...servidor.lotes.keys()]).toEqual([lote.id])
    expect([...servidor.prendas.keys()]).toEqual([prenda.id])
    expect(leerEstado().pendientes).toBe(0)
    // Tras subir, lo local queda igual que el servidor (con su foto remota).
    const [local] = await ds.listarPrendas()
    expect(local.fotoUrl).toBe(`https://api.test/fotos/${prenda.id}_detalle.webp`)
  })

  it('una venta hecha sin red conserva su hora y no se duplica si se pierde la respuesta', async () => {
    const { servidor, ds, motor } = crear()
    const prenda = await ds.crearPrenda(PRENDA(null), FOTO())
    await motor.sincronizar()

    servidor.enLinea = false
    const venta = await ds.registrarVenta(prenda.id, VENTA)
    expect((await ds.listarPrendas())[0].status).toBe('vendida')
    await reposo()

    // Primer intento: el servidor guarda pero la respuesta se pierde.
    servidor.enLinea = true
    servidor.perderProximaRespuesta = true
    expect(await motor.sincronizar()).toBe('sin-red')
    expect(servidor.ventas.size).toBe(1)

    // Segundo intento con el mismo id: sigue siendo una sola venta.
    expect(await motor.sincronizar()).toBe('vacia')
    expect(servidor.ventas.size).toBe(1)
    expect([...servidor.ventas.keys()]).toEqual([venta.id])
    expect(servidor.ventas.get(venta.id)?.fechaVenta).toBe(venta.fechaVenta)
  })

  it('no deja vender dos veces la misma prenda en el dispositivo', async () => {
    const { ds } = crear()
    const prenda = await ds.crearPrenda(PRENDA(null), FOTO())
    await ds.registrarVenta(prenda.id, VENTA)
    await expect(ds.registrarVenta(prenda.id, VENTA)).rejects.toThrow(/ya está vendida/)
  })

  it('si el servidor rechaza un cambio, lo descarta, avisa y deja los datos como el servidor', async () => {
    const { servidor, ds, motor } = crear()
    const prenda = await ds.crearPrenda(PRENDA(null), FOTO())
    await motor.sincronizar()

    // Otro dispositivo la vendió mientras este estaba sin red.
    servidor.prendas.set(prenda.id, { ...servidor.prendas.get(prenda.id)!, status: 'vendida' })
    servidor.enLinea = false
    await ds.registrarVenta(prenda.id, VENTA) // localmente aún figuraba disponible
    await reposo()

    servidor.enLinea = true
    await motor.sincronizar()

    expect(leerEstado().pendientes).toBe(0)
    expect(leerEstado().avisos.some((a) => a.includes('ya está vendida'))).toBe(true)
    expect((await ds.listarPrendas())[0].status).toBe('vendida') // manda el servidor
  })

  it('borrar algo que ya no existe en el servidor no cuenta como error', async () => {
    const { servidor, ds, motor } = crear()
    const lote = await ds.crearLote(LOTE)
    await motor.sincronizar()
    servidor.lotes.delete(lote.id) // ya lo borró otro dispositivo
    await ds.eliminarLote(lote.id)
    await motor.sincronizar()
    expect(leerEstado().avisos).toEqual([])
    expect(leerEstado().pendientes).toBe(0)
  })

  it('no deja cerrar sesión con cambios sin subir', async () => {
    const { servidor, ds } = crear()
    servidor.enLinea = false
    await ds.crearLote(LOTE)
    await expect(ds.logout()).rejects.toThrow(/sin subir/)
    expect((await ds.listarLotes()).length).toBe(1) // no se borró nada
  })

  it('cerrar sesión en todos lados: primero sube lo pendiente; sin red no cierra ni borra nada', async () => {
    const { servidor, ds } = crear()
    servidor.enLinea = false
    await ds.crearLote(LOTE)
    await expect(ds.cerrarSesionEnTodos()).rejects.toThrow(/sin subir/)
    expect(servidor.llamadas).not.toContain('cerrarSesionEnTodos')
    expect((await ds.listarLotes()).length).toBe(1)

    servidor.enLinea = true
    await ds.cerrarSesionEnTodos()
    expect(servidor.lotes.size).toBe(1) // lo pendiente subió antes de cerrar
    expect(servidor.llamadas).toContain('cerrarSesionEnTodos')
  })

  it('devolución sin conexión: cambia la prenda en el teléfono y se sube al volver la red', async () => {
    const { servidor, ds, motor } = crear()
    const prenda = await ds.crearPrenda(PRENDA(null), FOTO())
    const venta = await ds.registrarVenta(prenda.id, VENTA)
    expect(await motor.sincronizar()).toBe('vacia')
    servidor.enLinea = false
    const devuelta = await ds.registrarDevolucion(venta.id, { reembolso: VENTA.precioFinal, destino: 'disponible' })
    expect(devuelta.destinoDevolucion).toBe('disponible')
    expect((await ds.obtenerPrenda(prenda.id))?.status).toBe('disponible')
    expect(await motor.sincronizar()).toBe('sin-red')
    expect(servidor.ventas.get(venta.id)?.devueltaEn).toBeFalsy()

    servidor.enLinea = true
    expect(await motor.sincronizar()).toBe('vacia')
    expect(servidor.ventas.get(venta.id)?.destinoDevolucion).toBe('disponible')
    expect(servidor.prendas.get(prenda.id)?.status).toBe('disponible')
  })

  it('abre sin conexión con la última sesión conocida', async () => {
    const { servidor, ds } = crear()
    expect(await ds.usuariaActual()).toEqual({ email: 'vendedora@correo.com' })
    servidor.enLinea = false
    expect(await ds.usuariaActual()).toEqual({ email: 'vendedora@correo.com' })
  })

  it('el remanente de centavos va a la última prenda creada, también sin conexión', async () => {
    const { servidor, ds } = crear()
    servidor.enLinea = false
    const lote = await ds.crearLote({ ...LOTE, costoTotal: 10000, piezasCompradas: 3 })
    const ids: string[] = []
    for (let i = 0; i < 3; i++) ids.push((await ds.crearPrenda(PRENDA(lote.id), FOTO())).id)

    const costos = new Map((await ds.listarPrendas()).map((p) => [p.id, p.costo]))
    expect([...costos.values()].reduce((a, b) => a + b, 0)).toBe(10000)
    expect(costos.get(ids[2])).toBe(3334)
    expect(costos.get(ids[0])).toBe(3333)
  })

  it('un cambio que el servidor no puede procesar no bloquea la cola ni se pierde', async () => {
    const { servidor, ds, motor } = crear()
    servidor.enLinea = false
    const mala = await ds.crearPrenda(PRENDA(null), FOTO())
    const lote = await ds.crearLote(LOTE)
    await reposo()
    servidor.fallarCon.add(mala.id)
    servidor.enLinea = true

    // Tres respuestas 500 seguidas: el cambio se manda al final y el lote sí sube.
    for (let i = 0; i < 3; i++) await motor.sincronizar()
    expect(servidor.lotes.has(lote.id)).toBe(true)
    expect(servidor.prendas.has(mala.id)).toBe(false)
    expect(leerEstado().atorados).toBe(1)
    expect(leerEstado().pendientes).toBe(1)

    // Al bajar lo del servidor, la prenda atorada se conserva en el teléfono.
    expect((await ds.listarPrendas()).map((p) => p.id)).toContain(mala.id)

    // Cuando el servidor se arregla, sube y deja de estar atorada.
    servidor.fallarCon.clear()
    await motor.sincronizar()
    expect(servidor.prendas.has(mala.id)).toBe(true)
    expect(leerEstado().atorados).toBe(0)
    expect(leerEstado().pendientes).toBe(0)
  })

  it('si la cuota de fotos está llena, la prenda NO se pierde: espera, su venta también, y lo demás sube', async () => {
    const { servidor, ds, motor } = crear()
    servidor.enLinea = false
    const prenda = await ds.crearPrenda(PRENDA(null), FOTO())
    await ds.registrarVenta(prenda.id, VENTA)
    const lote = await ds.crearLote(LOTE)
    await reposo()
    servidor.cuotaLlena = true
    servidor.enLinea = true

    await motor.sincronizar()
    expect(servidor.lotes.has(lote.id)).toBe(true) // lo que no depende de la prenda sí sube
    expect(servidor.prendas.has(prenda.id)).toBe(false)
    expect(servidor.ventas.size).toBe(0) // la venta espera a su prenda (no se descarta con 404)
    expect(leerEstado().pendientes).toBe(2)
    expect(leerEstado().avisos.some((a) => a.includes('límite de espacio'))).toBe(true)
    expect((await ds.listarPrendas()).map((p) => p.id)).toContain(prenda.id)

    // Al liberar espacio (o subir de plan), sube todo en orden.
    servidor.cuotaLlena = false
    await motor.sincronizar()
    expect(servidor.prendas.has(prenda.id)).toBe(true)
    expect(servidor.ventas.size).toBe(1)
    expect(leerEstado().pendientes).toBe(0)
  })

  it('restaurar una prenda descartada vuelve a cuadrar el lote al centavo', async () => {
    const { servidor, ds } = crear()
    servidor.enLinea = false
    const lote = await ds.crearLote({ ...LOTE, costoTotal: 10000, piezasCompradas: 3 })
    const ids: string[] = []
    for (let i = 0; i < 3; i++) ids.push((await ds.crearPrenda(PRENDA(lote.id), FOTO())).id)

    await ds.cambiarStatus(ids[2], 'descartada')
    await ds.cambiarStatus(ids[2], 'disponible')

    const total = (await ds.listarPrendas()).reduce((a, p) => a + p.costo, 0)
    expect(total).toBe(10000)
  })
})
