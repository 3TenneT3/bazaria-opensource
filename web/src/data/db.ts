import { openDB, type IDBPDatabase } from 'idb'
import type { Lote, Prenda, Venta } from '@/domain/types'
import type { Usuaria } from './DataSource'
import type { OperacionPendiente } from './sincronizacion/tipos'

export const DB_NAME = 'bazar-app-demo'
export const DB_VERSION = 1

export interface BazarDB {
  lotes: Lote
  prendas: Prenda
  ventas: Venta
  fotos: { id: string; blob: Blob }
  meta: { clave: string; valor: unknown }
  /** Cambios hechos sin conexión que faltan por subir (solo lo usa el modo api). */
  outbox: OperacionPendiente
}

const STORES: (keyof BazarDB)[] = ['lotes', 'prendas', 'ventas', 'fotos', 'meta', 'outbox']

function claveDe(valor: unknown): string {
  const v = valor as { id?: string; clave?: string }
  return (v.id ?? v.clave) as string
}

/**
 * Una base de datos local con nombre propio. IndexedDB si está disponible; si falla
 * (modo privado, cuota), un fallback en memoria que dura mientras la pestaña esté abierta.
 *
 * Hay una para la demo (`almacenDemo`, con datos de ejemplo) y otra para el modo api
 * (cache y cola de cambios pendientes). Así nunca se mezclan.
 */
export class Almacen {
  private dbPromise: Promise<IDBPDatabase> | null = null
  private memoria: Map<string, Map<string, unknown>> | null = null

  readonly nombre: string
  private readonly version: number

  constructor(nombre: string, version = DB_VERSION) {
    this.nombre = nombre
    this.version = version
  }

  /** Abre (o crea) la base. Si falla, activa el fallback en memoria y devuelve null. */
  async getDB(): Promise<IDBPDatabase | null> {
    if (this.memoria) return null
    if (this.dbPromise) return this.dbPromise

    try {
      this.dbPromise = openDB(this.nombre, this.version, {
        upgrade(db) {
          for (const store of STORES) {
            if (!db.objectStoreNames.contains(store)) {
              db.createObjectStore(store, { keyPath: store === 'meta' ? 'clave' : 'id' })
            }
          }
        },
      })
      await this.dbPromise
      return this.dbPromise
    } catch (err) {
      console.warn('IndexedDB no disponible, usando fallback en memoria:', err)
      this.memoria = new Map()
      this.dbPromise = null
      return null
    }
  }

  usandoFallback(): boolean {
    return this.memoria !== null
  }

  private mapa(store: string): Map<string, unknown> {
    this.memoria ??= new Map()
    let m = this.memoria.get(store)
    if (!m) {
      m = new Map()
      this.memoria.set(store, m)
    }
    return m
  }

  async borrarTodo(): Promise<void> {
    const db = await this.getDB()
    if (db) {
      await Promise.all(STORES.filter((s) => db.objectStoreNames.contains(s)).map((s) => db.clear(s)))
    } else {
      this.memoria?.clear()
    }
  }

  async getAll<K extends keyof BazarDB>(store: K): Promise<BazarDB[K][]> {
    const db = await this.getDB()
    if (db) {
      if (!db.objectStoreNames.contains(store)) return []
      return db.getAll(store)
    }
    return [...this.mapa(store).values()] as BazarDB[K][]
  }

  async get<K extends keyof BazarDB>(store: K, id: string): Promise<BazarDB[K] | undefined> {
    const db = await this.getDB()
    if (db) return db.get(store, id)
    return this.mapa(store).get(id) as BazarDB[K] | undefined
  }

  async put<K extends keyof BazarDB>(store: K, valor: BazarDB[K]): Promise<void> {
    const db = await this.getDB()
    if (db) {
      await db.put(store, valor)
      return
    }
    this.mapa(store).set(claveDe(valor), valor)
  }

  async del<K extends keyof BazarDB>(store: K, id: string): Promise<void> {
    const db = await this.getDB()
    if (db) {
      await db.delete(store, id)
      return
    }
    this.mapa(store).delete(id)
  }

  async getFoto(id: string): Promise<Blob | undefined> {
    return (await this.get('fotos', id))?.blob
  }

  async putFoto(id: string, blob: Blob): Promise<void> {
    await this.put('fotos', { id, blob })
  }

  async getMeta(clave: string): Promise<unknown> {
    return (await this.get('meta', clave))?.valor
  }

  async putMeta(clave: string, valor: unknown): Promise<void> {
    await this.put('meta', { clave, valor })
  }

  async getUsuariaActual(): Promise<Usuaria | null> {
    return ((await this.getMeta('usuariaActual')) as Usuaria | null) ?? null
  }
}

/** Base de la demo (datos de ejemplo). Los exports de abajo son atajos sobre ella. */
export const almacenDemo = new Almacen(DB_NAME, DB_VERSION)

export const getDB = () => almacenDemo.getDB()
export const usandoFallback = () => almacenDemo.usandoFallback()
export const borrarTodo = () => almacenDemo.borrarTodo()
export const getAll = <K extends keyof BazarDB>(store: K) => almacenDemo.getAll(store)
export const get = <K extends keyof BazarDB>(store: K, id: string) => almacenDemo.get(store, id)
export const put = <K extends keyof BazarDB>(store: K, valor: BazarDB[K]) => almacenDemo.put(store, valor)
export const del = <K extends keyof BazarDB>(store: K, id: string) => almacenDemo.del(store, id)
export const getFoto = (id: string) => almacenDemo.getFoto(id)
export const putFoto = (id: string, blob: Blob) => almacenDemo.putFoto(id, blob)
export const getMeta = (clave: string) => almacenDemo.getMeta(clave)
export const putMeta = (clave: string, valor: unknown) => almacenDemo.putMeta(clave, valor)
export const getUsuariaActual = () => almacenDemo.getUsuariaActual()
