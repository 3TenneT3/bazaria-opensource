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
import type { ApiDataSource } from './ApiDataSource'
import { Almacen } from './db'
import { DemoDataSource } from './DemoDataSource'
import { MotorSync } from './sincronizacion/motor'
import { ErrorRed } from './sincronizacion/tipos'
import { actualizarEstado } from './sincronizacion/estado'

const ESPERA_PRIMERA_CARGA_MS = 8_000

let ultimaMarca = 0
/**
 * Hora de captura estrictamente creciente. Dos prendas creadas en el mismo milisegundo (p. ej. al
 * importar un Excel) tendrían la misma hora y el remanente de centavos del prorrateo, que va a la
 * última por orden de creación, quedaría al azar y distinto entre el dispositivo y el servidor.
 */
function ahoraMonotono(): string {
  ultimaMarca = Math.max(Date.now(), ultimaMarca + 1)
  return new Date(ultimaMarca).toISOString()
}
const SYNC_PERIODICA_MS = 60_000

/** Base local del modo api: copia de tus datos + cola de cambios pendientes. */
export const almacenApi = new Almacen('bazaria-datos', 1)

/**
 * DataSource del modo api: primero local, después servidor.
 *
 * Todas las lecturas y escrituras van al almacén local (rápido y sin red). Cada escritura se
 * apunta además en una cola que `MotorSync` sube cuando hay conexión. Por eso la app abre y guarda
 * sin señal, y todo llega al servidor al reconectar.
 *
 * Reglas honestas:
 * - Hay que iniciar sesión (y bajar tus datos) al menos una vez con internet en el dispositivo.
 * - Si el servidor rechaza un cambio hecho sin conexión (por ejemplo, vender una prenda que ya
 *   vendiste en otro dispositivo), gana el servidor y la app te avisa.
 * - Varias personas editando lo mismo al mismo tiempo no está resuelto: gana el último en llegar.
 */
export class OfflineDataSource implements DataSource {
  private readonly api: ApiDataSource
  private readonly local: DemoDataSource
  private readonly motor: MotorSync
  private readonly almacen: Almacen
  private hidratacion: Promise<void> | null = null
  private fotosPrecalentadas = new Set<string>()

  constructor(api: ApiDataSource, almacen: Almacen = almacenApi) {
    this.api = api
    this.almacen = almacen
    this.local = new DemoDataSource(almacen, false)
    this.motor = new MotorSync(almacen, api)
    this.iniciarSincronizacionAutomatica()
  }

  // --- Arranque y disparadores de sincronización ---

  private iniciarSincronizacionAutomatica(): void {
    if (typeof window === 'undefined') return
    const sync = () => void this.sincronizar()
    window.addEventListener('online', sync)
    window.addEventListener('offline', () => actualizarEstado({ sinConexion: true }))
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') sync()
    })
    setInterval(() => {
      if (document.visibilityState === 'visible') sync()
    }, SYNC_PERIODICA_MS)
    actualizarEstado({ sinConexion: navigator.onLine === false })
  }

  private async sincronizar(): Promise<void> {
    await this.motor.sincronizar()
    void this.precalentarFotos()
  }

  /**
   * Primera lectura: si este dispositivo nunca ha bajado tus datos, se esperan (hasta un tope)
   * para no pintar una pantalla vacía. Si ya los tiene, se pinta al instante y se actualiza detrás.
   */
  private listo(): Promise<void> {
    this.hidratacion ??= (async () => {
      await this.motor.contarPendientes()
      const yaSincronizo = await this.almacen.getMeta('ultimaSync')
      if (yaSincronizo) {
        void this.sincronizar()
        return
      }
      await Promise.race([
        this.sincronizar(),
        new Promise<void>((resolver) => setTimeout(resolver, ESPERA_PRIMERA_CARGA_MS)),
      ])
    })()
    return this.hidratacion
  }

  /**
   * Pide las fotos al servidor en segundo plano para que el service worker las guarde:
   * así el inventario se ve completo también sin conexión.
   */
  private async precalentarFotos(): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    const prendas = await this.almacen.getAll('prendas')
    const urls = prendas
      .flatMap((p) => [p.fotoMiniUrl, p.fotoUrl])
      // La firma cambia a diario; se compara por ruta para no bajar dos veces la misma foto.
      .filter((u): u is string => !!u && /^https?:/.test(u) && !this.fotosPrecalentadas.has(u.split('?')[0]))

    let i = 0
    const trabajador = async () => {
      while (i < urls.length) {
        const url = urls[i++]
        this.fotosPrecalentadas.add(url.split('?')[0])
        try {
          await fetch(url, { mode: 'cors', credentials: 'omit' })
        } catch {
          this.fotosPrecalentadas.delete(url.split('?')[0]) // sin red: se intenta en la próxima sincronización
          return
        }
      }
    }
    await Promise.all([trabajador(), trabajador(), trabajador()])
  }

  // --- Auth ---

  async usuariaActual(): Promise<Usuaria | null> {
    if (!this.api.tieneSesion()) return null
    try {
      const u = await this.api.usuariaActualEstricto()
      if (!u) return null
      // Otro correo en este dispositivo: nada de lo local es de esta cuenta.
      const guardada = (await this.almacen.getMeta('usuaria')) as Usuaria | undefined
      if (guardada && guardada.email !== u.email) {
        await this.almacen.borrarTodo()
        this.hidratacion = null
        actualizarEstado({ pendientes: 0, avisos: [] })
      }
      await this.almacen.putMeta('usuaria', u)
      return u
    } catch (e) {
      if (e instanceof ErrorRed) {
        // Sin conexión: se confía en la última sesión conocida para poder abrir la app.
        const guardada = (await this.almacen.getMeta('usuaria')) as Usuaria | undefined
        return guardada ?? null
      }
      return null
    }
  }

  async logout(): Promise<void> {
    await this.motor.sincronizar()
    const pendientes = await this.motor.contarPendientes()
    if (pendientes > 0) {
      throw new Error(
        `Tienes ${pendientes} cambio${pendientes === 1 ? '' : 's'} sin subir. Conéctate a internet antes de cerrar sesión.`,
      )
    }
    await this.api.logout()
    await this.almacen.borrarTodo()
    this.hidratacion = null
  }

  async cerrarSesionEnTodos(): Promise<void> {
    // Igual que logout: primero subir lo pendiente, porque después ya no hay sesión para subirlo.
    await this.motor.sincronizar()
    const pendientes = await this.motor.contarPendientes()
    if (pendientes > 0) {
      throw new Error(
        `Tienes ${pendientes} cambio${pendientes === 1 ? '' : 's'} sin subir. Conéctate a internet antes de cerrar sesión.`,
      )
    }
    await this.api.cerrarSesionEnTodos() // exige conexión: es una acción del servidor
    await this.almacen.borrarTodo()
    this.hidratacion = null
  }

  async eliminarCuenta(): Promise<void> {
    await this.api.eliminarCuenta() // exige conexión: es una acción del servidor
    await this.almacen.borrarTodo()
    this.hidratacion = null
  }

  // --- Lotes ---

  async listarLotes(): Promise<Lote[]> {
    await this.listo()
    return this.local.listarLotes()
  }

  async crearLote(data: CrearLoteInput): Promise<Lote> {
    await this.listo()
    const id = crypto.randomUUID()
    const lote = await this.motor.serializar(async () => {
      const l = await this.local.crearLote(data, { id })
      await this.motor.encolar({ tipo: 'crearLote', id, data })
      return l
    })
    this.motor.disparar()
    return lote
  }

  async actualizarLote(id: string, data: Partial<CrearLoteInput>): Promise<Lote> {
    await this.listo()
    const lote = await this.motor.serializar(async () => {
      const l = await this.local.actualizarLote(id, data)
      await this.motor.encolar({ tipo: 'actualizarLote', id, data })
      return l
    })
    this.motor.disparar()
    return lote
  }

  async eliminarLote(id: string): Promise<void> {
    await this.listo()
    await this.motor.serializar(async () => {
      await this.local.eliminarLote(id)
      await this.motor.encolar({ tipo: 'eliminarLote', id })
    })
    this.motor.disparar()
  }

  // --- Prendas ---

  async listarPrendas(filtros?: FiltrosPrendas): Promise<Prenda[]> {
    await this.listo()
    return this.local.listarPrendas(filtros)
  }

  async obtenerPrenda(id: string): Promise<Prenda | null> {
    await this.listo()
    return this.local.obtenerPrenda(id)
  }

  async crearPrenda(data: CrearPrendaInput, foto: Blob): Promise<Prenda> {
    await this.listo()
    const id = crypto.randomUUID()
    const creadoEn = ahoraMonotono()
    const prenda = await this.motor.serializar(async () => {
      const p = await this.local.crearPrenda(data, foto, { id, fecha: creadoEn })
      await this.motor.encolar({ tipo: 'crearPrenda', id, data, creadoEn })
      return p
    })
    this.motor.disparar()
    return prenda
  }

  async actualizarPrenda(id: string, data: Partial<CrearPrendaInput>): Promise<Prenda> {
    await this.listo()
    const prenda = await this.motor.serializar(async () => {
      const p = await this.local.actualizarPrenda(id, data)
      await this.motor.encolar({ tipo: 'actualizarPrenda', id, data })
      return p
    })
    this.motor.disparar()
    return prenda
  }

  async cambiarStatus(id: string, status: StatusPrenda): Promise<Prenda> {
    await this.listo()
    const prenda = await this.motor.serializar(async () => {
      const p = await this.local.cambiarStatus(id, status)
      await this.motor.encolar({ tipo: 'cambiarStatus', id, status })
      return p
    })
    this.motor.disparar()
    return prenda
  }

  // --- Ventas ---

  async registrarVenta(prendaId: string, data: RegistrarVentaInput): Promise<Venta> {
    await this.listo()
    const id = crypto.randomUUID()
    const fechaVenta = ahoraMonotono()
    const venta = await this.motor.serializar(async () => {
      const prenda = await this.local.obtenerPrenda(prendaId)
      if (!prenda) throw new Error('Prenda no encontrada')
      if (prenda.status === 'vendida') throw new Error('Esta prenda ya está vendida. Deshaz la venta para registrarla de nuevo.')
      const v = await this.local.registrarVenta(prendaId, data, { id, fecha: fechaVenta })
      await this.motor.encolar({ tipo: 'registrarVenta', id, prendaId, data, fechaVenta })
      return v
    })
    this.motor.disparar()
    return venta
  }

  async listarVentas(rango?: RangoFechas): Promise<Venta[]> {
    await this.listo()
    return this.local.listarVentas(rango)
  }

  async deshacerVenta(ventaId: string): Promise<void> {
    await this.listo()
    await this.motor.serializar(async () => {
      await this.local.deshacerVenta(ventaId)
      await this.motor.encolar({ tipo: 'deshacerVenta', id: ventaId })
    })
    this.motor.disparar()
  }

  // --- IA (necesita servidor) ---

  async analizarFoto(foto: Blob): Promise<AnalisisVision | null> {
    return this.api.analizarFoto(foto)
  }

  // --- Reportes (se calculan con lo local) ---

  async resumenMes(anio: number, mes: number): Promise<ResumenMes> {
    await this.listo()
    return this.local.resumenMes(anio, mes)
  }

  async resumenLote(loteId: string): Promise<ResumenLote> {
    await this.listo()
    return this.local.resumenLote(loteId)
  }

  /** Foto guardada en este dispositivo (prendas que aún no suben, o respaldo si falla la URL). */
  fotoLocal(id: string): Promise<Blob | undefined> {
    return this.almacen.getFoto(id)
  }
}
