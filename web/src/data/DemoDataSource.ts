import type {
  DataSource,
  Usuaria,
  FiltrosPrendas,
  CrearLoteInput,
  CrearPrendaInput,
  RegistrarVentaInput,
  RangoFechas,
} from './DataSource'
import type { Lote, Prenda, Venta, AnalisisVision, ResumenMes, ResumenLote, StatusPrenda } from '@/domain/types'
import { prorratearLote, recuperacionLote } from '@/domain/costos'
import { resumenMes as calcularResumenMes } from '@/domain/resumen'
import * as demoDb from './db'
import { almacenDemo, type Almacen } from './db'
import { generarSemilla } from './seed'
import { analizarFotoMock } from './visionMock'


function idAleatorio(): string {
  return crypto.randomUUID()
}

/** Cuando el motor local sirve de caché del modo api, el llamador fija id y hora (van a la cola de subida). */
export interface OpcionesCreacion {
  id?: string
  /** ISO 8601: hora real de captura. */
  fecha?: string
}

/** El remanente de centavos va a la última prenda: hay que repartir siempre en orden de creación. */
function porCreacion<T extends { creadoEn: string; id: string }>(prendas: T[]): T[] {
  return [...prendas].sort((a, b) => a.creadoEn.localeCompare(b.creadoEn) || a.id.localeCompare(b.id))
}

// Una sola siembra a la vez: al cargar la app varias pantallas piden datos en paralelo y,
// sin esto, cada una veía "no sembrado" y cargaba los lotes otra vez (lotes duplicados).
let siembraEnCurso: Promise<void> | null = null

function asegurarSemilla(): Promise<void> {
  siembraEnCurso ??= sembrarSiFalta().catch((e) => {
    siembraEnCurso = null // si falló, que el siguiente intento vuelva a probar
    throw e
  })
  return siembraEnCurso
}

async function sembrarSiFalta(): Promise<void> {
  const yaSembrado = await demoDb.getMeta('sembrado')
  if (yaSembrado) return

  const { lotes, prendas, ventas } = generarSemilla()
  await Promise.all(lotes.map((l) => demoDb.put('lotes', l)))
  await Promise.all(prendas.map((p) => demoDb.put('prendas', p)))
  await Promise.all(ventas.map((v) => demoDb.put('ventas', v)))
  await demoDb.putMeta('sembrado', true)
}

/** Reinicia la demo: borra todo y vuelve a cargar el seed. */
export async function reiniciarDemo(): Promise<void> {
  await demoDb.borrarTodo()
  siembraEnCurso = null
  await asegurarSemilla()
}

export class DemoDataSource implements DataSource {
  private inicializado = false

  /**
   * @param db almacén donde guarda (por defecto, el de la demo).
   * @param sembrar si carga los datos de ejemplo la primera vez. Solo tiene sentido en la demo.
   */
  private readonly db: Almacen
  private readonly sembrar: boolean

  constructor(db: Almacen = almacenDemo, sembrar = true) {
    this.db = db
    this.sembrar = sembrar
  }

  private async init(): Promise<void> {
    if (this.inicializado) return
    if (this.sembrar) await asegurarSemilla()
    this.inicializado = true
  }

  // --- Auth (simulada) ---

  async logout(): Promise<void> {
    await this.db.putMeta('usuariaActual', null)
  }

  async cerrarSesionEnTodos(): Promise<void> {
    await this.logout() // en la demo solo existe este dispositivo
  }

  async eliminarCuenta(): Promise<void> {
    await this.db.borrarTodo()
    siembraEnCurso = null
  }

  async usuariaActual(): Promise<Usuaria | null> {
    return this.db.getUsuariaActual()
  }

  // --- Lotes ---

  async listarLotes(): Promise<Lote[]> {
    await this.init()
    const lotes = await this.db.getAll('lotes')
    return lotes.sort(
      (a, b) => new Date(b.fechaCompra).getTime() - new Date(a.fechaCompra).getTime(),
    )
  }

  async crearLote(data: CrearLoteInput, opciones?: OpcionesCreacion): Promise<Lote> {
    await this.init()
    const lote: Lote = { id: opciones?.id ?? idAleatorio(), ...data }
    await this.db.put('lotes', lote)
    return lote
  }

  async actualizarLote(id: string, data: Partial<CrearLoteInput>): Promise<Lote> {
    await this.init()
    const existente = await this.db.get('lotes', id)
    if (!existente) throw new Error('Lote no encontrado')
    const actualizado: Lote = { ...existente, ...data }
    await this.db.put('lotes', actualizado)

    // Recalcular prorrateo de las prendas del lote (excepto costoManual)
    const todasLasPrendas = await this.db.getAll('prendas')
    const prendasDelLote = porCreacion(
      todasLasPrendas.filter((p) => p.loteId === id && p.status !== 'descartada'),
    )
    const recalculadas = prorratearLote(
      actualizado.costoTotal,
      actualizado.piezasCompradas,
      actualizado.piezasDescartadas,
      prendasDelLote,
    )
    await Promise.all(recalculadas.map((p) => this.db.put('prendas', p)))

    return actualizado
  }

  async eliminarLote(id: string): Promise<void> {
    await this.init()
    await this.db.del('lotes', id)
    // Las prendas del lote no se borran: quedan sin lote (igual que en el backend).
    const prendas = await this.db.getAll('prendas')
    await Promise.all(
      prendas.filter((p) => p.loteId === id).map((p) => this.db.put('prendas', { ...p, loteId: null })),
    )
  }

  // --- Prendas ---

  async listarPrendas(filtros?: FiltrosPrendas): Promise<Prenda[]> {
    await this.init()
    let prendas = await this.db.getAll('prendas')

    if (filtros?.status) {
      prendas = prendas.filter((p) => p.status === filtros.status)
    }
    if (filtros?.tipo) {
      prendas = prendas.filter((p) => p.tipo === filtros.tipo)
    }
    if (filtros?.talla) {
      prendas = prendas.filter((p) => p.talla === filtros.talla)
    }
    if (filtros?.loteId !== undefined) {
      prendas = prendas.filter((p) => p.loteId === filtros.loteId)
    }
    if (filtros?.texto) {
      const texto = filtros.texto.toLowerCase()
      prendas = prendas.filter((p) =>
        [p.tipo, p.color, p.marca, p.talla].some((campo) =>
          campo?.toLowerCase().includes(texto),
        ),
      )
    }

    return prendas.sort(
      (a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime(),
    )
  }

  async obtenerPrenda(id: string): Promise<Prenda | null> {
    await this.init()
    const prenda = await this.db.get('prendas', id)
    return prenda ?? null
  }

  async crearPrenda(data: CrearPrendaInput, foto: Blob, opciones?: OpcionesCreacion): Promise<Prenda> {
    await this.init()
    const id = opciones?.id ?? idAleatorio()
    await this.db.putFoto(id, foto)
    const fotoUrl = URL.createObjectURL(foto)

    const prenda: Prenda = {
      id,
      fotoUrl,
      status: 'disponible',
      creadoEn: opciones?.fecha ?? new Date().toISOString(),
      ...data,
    }
    await this.db.put('prendas', prenda)

    // Si pertenece a un lote, recalcular prorrateo (excepto prendas con costoManual)
    if (prenda.loteId) {
      const lote = await this.db.get('lotes', prenda.loteId)
      if (lote) {
        const todasLasPrendas = await this.db.getAll('prendas')
        const prendasDelLote = porCreacion(
          todasLasPrendas.filter((p) => p.loteId === lote.id && p.status !== 'descartada'),
        )
        const recalculadas = prorratearLote(
          lote.costoTotal,
          lote.piezasCompradas,
          lote.piezasDescartadas,
          prendasDelLote,
        )
        await Promise.all(recalculadas.map((p) => this.db.put('prendas', p)))
      }
    }

    return (await this.db.get('prendas', id))!
  }

  async actualizarPrenda(id: string, data: Partial<CrearPrendaInput>): Promise<Prenda> {
    await this.init()
    const existente = await this.db.get('prendas', id)
    if (!existente) throw new Error('Prenda no encontrada')
    const actualizada: Prenda = { ...existente, ...data }
    await this.db.put('prendas', actualizada)

    // Igual que el backend: cambiar de lote, costo manual o costo mueve el reparto del lote viejo y del nuevo.
    for (const loteId of new Set([existente.loteId, actualizada.loteId])) {
      if (loteId) await this.recalcularLote(loteId)
    }
    return (await this.db.get('prendas', id))!
  }

  async cambiarStatus(id: string, status: StatusPrenda): Promise<Prenda> {
    await this.init()
    const existente = await this.db.get('prendas', id)
    if (!existente) throw new Error('Prenda no encontrada')
    await this.db.put('prendas', { ...existente, status })

    // Entrar o salir de "descartada" cambia quién se reparte el costo del lote (también al restaurar).
    if (existente.loteId && existente.status !== status && [existente.status, status].includes('descartada')) {
      await this.recalcularLote(existente.loteId)
    }
    return (await this.db.get('prendas', id))!
  }

  /** Reparte el costo del lote entre sus prendas vigentes, en orden de creación (excepto costo manual). */
  private async recalcularLote(loteId: string): Promise<void> {
    const lote = await this.db.get('lotes', loteId)
    if (!lote) return
    const todasLasPrendas = await this.db.getAll('prendas')
    const prendasDelLote = porCreacion(
      todasLasPrendas.filter((p) => p.loteId === loteId && p.status !== 'descartada'),
    )
    const recalculadas = prorratearLote(lote.costoTotal, lote.piezasCompradas, lote.piezasDescartadas, prendasDelLote)
    await Promise.all(recalculadas.map((p) => this.db.put('prendas', p)))
  }

  // --- Ventas ---

  async registrarVenta(prendaId: string, data: RegistrarVentaInput, opciones?: OpcionesCreacion): Promise<Venta> {
    await this.init()
    const prenda = await this.db.get('prendas', prendaId)
    if (!prenda) throw new Error('Prenda no encontrada')

    const venta: Venta = {
      id: opciones?.id ?? idAleatorio(),
      prendaId,
      fechaVenta: opciones?.fecha ?? new Date().toISOString(),
      ...data,
    }
    await this.db.put('ventas', venta)
    await this.db.put('prendas', { ...prenda, status: 'vendida' })

    return venta
  }

  async listarVentas(rango?: RangoFechas): Promise<Venta[]> {
    await this.init()
    let ventas = await this.db.getAll('ventas')
    if (rango) {
      const desde = new Date(rango.desde).getTime()
      const hasta = new Date(rango.hasta).getTime()
      ventas = ventas.filter((v) => {
        const fecha = new Date(v.fechaVenta).getTime()
        return fecha >= desde && fecha <= hasta
      })
    }
    return ventas.sort(
      (a, b) => new Date(b.fechaVenta).getTime() - new Date(a.fechaVenta).getTime(),
    )
  }

  async deshacerVenta(ventaId: string): Promise<void> {
    await this.init()
    const venta = await this.db.get('ventas', ventaId)
    if (!venta) return
    const prenda = await this.db.get('prendas', venta.prendaId)
    if (prenda) {
      await this.db.put('prendas', { ...prenda, status: 'disponible' })
    }
    await this.db.del('ventas', ventaId)
  }

  // --- IA ---

  async analizarFoto(_foto: Blob): Promise<AnalisisVision | null> {
    return analizarFotoMock()
  }

  // --- Reportes ---

  async resumenMes(anio: number, mes: number): Promise<ResumenMes> {
    await this.init()
    const ventas = await this.db.getAll('ventas')
    const prendas = await this.db.getAll('prendas')
    return calcularResumenMes(anio, mes, ventas, prendas)
  }

  async resumenLote(loteId: string): Promise<ResumenLote> {
    await this.init()
    const lote = await this.db.get('lotes', loteId)
    if (!lote) throw new Error('Lote no encontrado')

    const prendas = await this.db.getAll('prendas')
    const prendasDelLote = prendas.filter((p) => p.loteId === loteId)

    const ventas = await this.db.getAll('ventas')
    const prendaIdsDelLote = new Set(prendasDelLote.map((p) => p.id))
    const ventasDelLote = ventas.filter((v) => prendaIdsDelLote.has(v.prendaId))

    const { recuperado, faltante } = recuperacionLote(
      lote.costoTotal,
      ventasDelLote.map((v) => v.precioFinal),
    )

    const piezasValidas = lote.piezasCompradas - lote.piezasDescartadas
    const costoUnitarioActual = piezasValidas > 0 ? Math.floor(lote.costoTotal / piezasValidas) : 0

    return { lote, recuperado, faltante, costoUnitarioActual }
  }
}
