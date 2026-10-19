import type { Lote, Prenda, StatusPrenda, Venta } from '@/domain/types'
import type { CrearLoteInput, CrearPrendaInput, RegistrarDevolucionInput, RegistrarVentaInput } from '../DataSource'
import type { Almacen } from '../db'
import { actualizarEstado, leerEstado } from './estado'
import { ErrorApi, ErrorRed, ErrorServidor, type Operacion, type OperacionPendiente } from './tipos'

/** Lo que el motor necesita del servidor (lo implementa ApiDataSource). */
export interface Remoto {
  crearLote(data: CrearLoteInput, opciones?: { id?: string }): Promise<Lote>
  actualizarLote(id: string, data: Partial<CrearLoteInput>): Promise<Lote>
  eliminarLote(id: string): Promise<void>
  crearPrenda(data: CrearPrendaInput, foto: Blob, opciones?: { id?: string; fecha?: string }): Promise<Prenda>
  actualizarPrenda(id: string, data: Partial<CrearPrendaInput>): Promise<Prenda>
  cambiarStatus(id: string, status: StatusPrenda): Promise<Prenda>
  eliminarPrenda(id: string): Promise<void>
  registrarVenta(prendaId: string, data: RegistrarVentaInput, opciones?: { id?: string; fecha?: string }): Promise<Venta>
  deshacerVenta(ventaId: string): Promise<void>
  registrarDevolucion(ventaId: string, data: RegistrarDevolucionInput, opciones?: { fecha?: string }): Promise<Venta>
  listarLotes(): Promise<Lote[]>
  listarPrendas(): Promise<Prenda[]>
  listarVentas(): Promise<Venta[]>
}

export type ResultadoDrenado = 'vacia' | 'sin-red' | 'sesion' | 'detenida' | 'atorada'

const ESPERAS_REINTENTO_MS = [5_000, 15_000, 30_000, 60_000]

/** Tras estas respuestas 5xx seguidas, el cambio se manda al final para no bloquear la cola. */
const FALLOS_PARA_ATORAR = 3

/** Campos que cambian solo porque la foto ahora vive en el servidor: no cuentan como "datos distintos". */
const sinFotos = <T extends { fotoUrl?: string; fotoMiniUrl?: string }>(x: T) => {
  const { fotoUrl: _a, fotoMiniUrl: _b, ...resto } = x
  return resto
}

/**
 * Sincroniza el almacén local con el servidor.
 *
 * - Escribir: cada cambio se aplica primero en el almacén local y se apunta en `outbox`.
 *   `drenar()` sube el outbox en orden; si no hay red, se queda y se reintenta.
 * - Leer: `traer()` baja lotes, prendas y ventas y reemplaza lo local, pero solo si no hay
 *   cambios pendientes (no pisa lo que el usuario capturó sin conexión).
 *
 * Si hay conflicto gana el servidor (un 4xx descarta el cambio y avisa).
 */
export class MotorSync {
  private readonly almacen: Almacen
  private readonly remoto: Remoto
  private cola: Promise<unknown> = Promise.resolve()
  private drenando: Promise<ResultadoDrenado> | null = null
  private timerReintento: ReturnType<typeof setTimeout> | null = null
  private fallosSeguidos = 0
  private contador = 0

  constructor(almacen: Almacen, remoto: Remoto) {
    this.almacen = almacen
    this.remoto = remoto
  }

  /**
   * Ejecuta `fn` en orden con las demás escrituras locales y la aplicación de un pull.
   * Así un cambio del usuario nunca queda a medias mientras llegan datos del servidor.
   */
  serializar<T>(fn: () => Promise<T>): Promise<T> {
    const r = this.cola.then(fn, fn)
    this.cola = r.catch(() => undefined)
    return r
  }

  private nuevaClave(): string {
    this.contador += 1
    return `${Date.now().toString().padStart(14, '0')}-${this.contador.toString().padStart(6, '0')}`
  }

  /** Apunta un cambio para subirlo. Llamar dentro de `serializar`, junto al cambio local. */
  async encolar(op: Operacion): Promise<void> {
    const registro: OperacionPendiente = { id: this.nuevaClave(), creadoEn: new Date().toISOString(), intentos: 0, op }
    await this.almacen.put('outbox', registro)
    await this.contarPendientes()
  }

  async pendientes(): Promise<OperacionPendiente[]> {
    return (await this.almacen.getAll('outbox')).sort((a, b) => a.id.localeCompare(b.id))
  }

  async contarPendientes(): Promise<number> {
    const todas = await this.almacen.getAll('outbox')
    actualizarEstado({ pendientes: todas.length, atorados: todas.filter((o) => o.atorada).length })
    return todas.length
  }

  /** Pide una sincronización sin esperar el resultado. */
  disparar(): void {
    void this.sincronizar()
  }

  /** Sube lo pendiente y, si quedó limpio, baja lo del servidor. */
  async sincronizar(): Promise<ResultadoDrenado> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      actualizarEstado({ sinConexion: true })
      await this.contarPendientes()
      return 'sin-red'
    }
    actualizarEstado({ sincronizando: true })
    try {
      const r = await this.drenar()
      // Con solo cambios atorados también se baja lo del servidor (sin pisar esos registros).
      if (r === 'vacia' || r === 'atorada') {
        const ok = await this.traer()
        if (!ok) return 'sin-red'
      }
      return r
    } finally {
      actualizarEstado({ sincronizando: false })
    }
  }

  /** Sube el outbox en orden. Una sola pasada a la vez. */
  drenar(): Promise<ResultadoDrenado> {
    this.drenando ??= this.drenarSinLock().finally(() => {
      this.drenando = null
    })
    return this.drenando
  }

  private async drenarSinLock(): Promise<ResultadoDrenado> {
    // Cada cambio se intenta una sola vez por pasada: un atorado que vuelve al final no se reintenta en bucle.
    const intentadas = new Set<string>()
    // Prendas que el servidor no aceptó todavía por cuota (espacio lleno o demasiadas fotos por
    // hora): lo que dependa de ellas (venta, cambio de status…) espera en la cola, no se manda.
    const retenidas = new Set<string>()
    for (;;) {
      const siguiente = (await this.pendientes()).find((o) => !intentadas.has(o.op.tipo + o.op.id + o.creadoEn))
      if (!siguiente) {
        const quedan = await this.contarPendientes()
        if (quedan === 0) return 'vacia'
        this.programarReintento() // solo quedan atorados: se vuelven a intentar más tarde
        return 'atorada'
      }
      intentadas.add(siguiente.op.tipo + siguiente.op.id + siguiente.creadoEn)
      if (dependeDeRetenida(siguiente.op, retenidas)) continue

      try {
        await this.ejecutar(siguiente.op)
        await this.almacen.del('outbox', siguiente.id)
        this.fallosSeguidos = 0
        actualizarEstado({ sinConexion: false })
        await this.contarPendientes()
      } catch (e) {
        if (e instanceof ErrorServidor) {
          // El servidor está arriba pero falla con este cambio. Si se repite, se manda al final de la
          // cola (sin borrarlo) para que no bloquee todo lo demás.
          const fallos = (siguiente.fallosServidor ?? 0) + 1
          if (fallos >= FALLOS_PARA_ATORAR) {
            const yaEstaba = siguiente.atorada
            await this.almacen.del('outbox', siguiente.id)
            await this.almacen.put('outbox', { ...siguiente, id: this.nuevaClave(), fallosServidor: fallos, atorada: true })
            if (!yaEstaba) {
              actualizarEstado({
                avisos: [...leerEstado().avisos, 'Un cambio no se ha podido subir por un error del servidor. Sigue guardado en tu teléfono y se reintentará.'],
              })
            }
            await this.contarPendientes()
            continue
          }
          await this.almacen.put('outbox', { ...siguiente, fallosServidor: fallos })
          this.programarReintento()
          await this.contarPendientes()
          return 'sin-red'
        }
        if (e instanceof ErrorRed) {
          actualizarEstado({ sinConexion: true })
          this.programarReintento()
          await this.contarPendientes()
          return 'sin-red'
        }
        if (e instanceof ErrorApi && e.status === 401) {
          return 'sesion' // la sesión venció: al recargar se pide login y lo pendiente se conserva
        }
        if (e instanceof ErrorApi && esCuota(e)) {
          // Límite de fotos (espacio o por hora): NO se descarta la prenda. Se queda guardada en el
          // teléfono y se reintenta más tarde; lo demás de la cola (p. ej. borrar prendas para
          // liberar espacio) sigue subiendo.
          if (siguiente.op.tipo === 'crearPrenda') retenidas.add(siguiente.op.id)
          if (!siguiente.atorada) {
            await this.almacen.put('outbox', { ...siguiente, atorada: true })
            actualizarEstado({ avisos: [...leerEstado().avisos, e.message] })
          }
          await this.contarPendientes()
          continue
        }
        if (e instanceof ErrorApi) {
          // El servidor entendió y dijo que no (validación, ya vendida, no existe…): reintentar no ayuda.
          const esBorrado =
            siguiente.op.tipo === 'eliminarLote' ||
            siguiente.op.tipo === 'eliminarPrenda' ||
            siguiente.op.tipo === 'deshacerVenta'
          await this.almacen.del('outbox', siguiente.id)
          if (!(esBorrado && e.status === 404)) {
            actualizarEstado({ avisos: [...leerEstado().avisos, mensajeDeRechazo(siguiente.op, e)] })
          }
          await this.contarPendientes()
          continue
        }
        // Error inesperado: no descartar datos del usuario. Se detiene y queda para revisar.
        console.error('Fallo inesperado al sincronizar', e)
        await this.contarPendientes()
        return 'detenida'
      }
    }
  }

  private programarReintento(): void {
    if (this.timerReintento) return
    const espera = ESPERAS_REINTENTO_MS[Math.min(this.fallosSeguidos, ESPERAS_REINTENTO_MS.length - 1)]
    this.fallosSeguidos += 1
    this.timerReintento = setTimeout(() => {
      this.timerReintento = null
      void this.sincronizar()
    }, espera)
  }

  private async ejecutar(op: Operacion): Promise<void> {
    switch (op.tipo) {
      case 'crearLote':
        await this.remoto.crearLote(op.data, { id: op.id })
        return
      case 'actualizarLote':
        await this.remoto.actualizarLote(op.id, op.data)
        return
      case 'eliminarLote':
        await this.remoto.eliminarLote(op.id)
        return
      case 'crearPrenda': {
        const foto = await this.almacen.getFoto(op.id)
        if (!foto) throw new ErrorApi('La foto de la prenda ya no está en este dispositivo.', 422)
        await this.remoto.crearPrenda(op.data, foto, { id: op.id, fecha: op.creadoEn })
        return
      }
      case 'actualizarPrenda':
        await this.remoto.actualizarPrenda(op.id, op.data)
        return
      case 'cambiarStatus':
        await this.remoto.cambiarStatus(op.id, op.status)
        return
      case 'eliminarPrenda':
        await this.remoto.eliminarPrenda(op.id)
        return
      case 'registrarVenta':
        await this.remoto.registrarVenta(op.prendaId, op.data, { id: op.id, fecha: op.fechaVenta })
        return
      case 'deshacerVenta':
        await this.remoto.deshacerVenta(op.id)
        return
      case 'registrarDevolucion':
        await this.remoto.registrarDevolucion(op.id, op.data, { fecha: op.fecha })
        return
    }
  }

  /**
   * Baja lo del servidor y reemplaza el almacén local. Devuelve false si no hubo red.
   * No hace nada si hay cambios pendientes: primero se suben.
   */
  async traer(): Promise<boolean> {
    let lotes: Lote[], prendas: Prenda[], ventas: Venta[]
    try {
      ;[lotes, prendas, ventas] = await Promise.all([
        this.remoto.listarLotes(),
        this.remoto.listarPrendas(),
        this.remoto.listarVentas(),
      ])
    } catch (e) {
      if (e instanceof ErrorRed) {
        actualizarEstado({ sinConexion: true })
        return false
      }
      return false
    }
    actualizarEstado({ sinConexion: false })

    await this.serializar(async () => {
      // Si mientras bajaba el usuario capturó algo, esos cambios locales mandan.
      const pendientes = await this.almacen.getAll('outbox')
      if (pendientes.some((o) => !o.atorada)) return

      // Lo que tiene un cambio atorado se conserva como está en el teléfono.
      const protegidos = new Set(pendientes.flatMap((o) => (o.op.tipo === 'registrarVenta' || o.op.tipo === 'registrarDevolucion' ? [o.op.id, o.op.prendaId] : [o.op.id])))
      const cambio = await this.reemplazar(lotes, prendas, ventas, protegidos)
      await this.almacen.putMeta('ultimaSync', new Date().toISOString())
      if (cambio) actualizarEstado({ version: leerEstado().version + 1 })
    })
    return true
  }

  /** Deja el almacén igual al servidor. Devuelve true si cambió algo que el usuario vería. */
  private async reemplazar(lotes: Lote[], prendas: Prenda[], ventas: Venta[], protegidos = new Set<string>()): Promise<boolean> {
    let cambio = false

    const sincronizar = async <T extends { id: string }>(
      store: 'lotes' | 'prendas' | 'ventas',
      remotos: T[],
      comparable: (x: T) => unknown = (x) => x,
    ) => {
      const locales = (await this.almacen.getAll(store)) as unknown as T[]
      const porId = new Map(locales.map((x) => [x.id, x]))
      const idsRemotos = new Set(remotos.map((x) => x.id))

      for (const r of remotos) {
        if (protegidos.has(r.id)) continue
        const l = porId.get(r.id)
        if (!l || JSON.stringify(comparable(l)) !== JSON.stringify(comparable(r))) cambio = true
        await this.almacen.put(store, r as never)
      }
      for (const l of locales) {
        if (!idsRemotos.has(l.id) && !protegidos.has(l.id)) {
          cambio = true
          await this.almacen.del(store, l.id)
          if (store === 'prendas') await this.almacen.del('fotos', l.id)
        }
      }
    }

    await sincronizar('lotes', lotes)
    await sincronizar('prendas', prendas, (p) => sinFotos(p as Prenda))
    await sincronizar('ventas', ventas)
    return cambio
  }
}

/** El servidor dijo "ahora no" por cuota de fotos: reintentar más tarde sí puede funcionar. */
function esCuota(e: ErrorApi): boolean {
  return e.codigo === 'CUOTA_FOTOS' || e.codigo === 'LIMITE_SUBIDAS'
}

function dependeDeRetenida(op: Operacion, retenidas: Set<string>): boolean {
  if (retenidas.size === 0) return false
  if (op.tipo === 'actualizarPrenda' || op.tipo === 'cambiarStatus' || op.tipo === 'eliminarPrenda') return retenidas.has(op.id)
  if (op.tipo === 'registrarVenta' || op.tipo === 'registrarDevolucion') return retenidas.has(op.prendaId)
  return false
}

function mensajeDeRechazo(op: Operacion, e: ErrorApi): string {
  const que: Record<Operacion['tipo'], string> = {
    crearLote: 'crear el lote',
    actualizarLote: 'actualizar el lote',
    eliminarLote: 'eliminar el lote',
    crearPrenda: 'guardar una prenda',
    actualizarPrenda: 'actualizar una prenda',
    cambiarStatus: 'cambiar el estado de una prenda',
    eliminarPrenda: 'borrar una prenda de la papelera',
    registrarVenta: 'registrar una venta',
    deshacerVenta: 'deshacer una venta',
    registrarDevolucion: 'registrar una devolución',
  }
  return `No se pudo ${que[op.tipo]}: ${e.message}`
}
