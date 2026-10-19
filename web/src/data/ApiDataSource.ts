import type {
  DataSource,
  Usuaria,
  FiltrosPrendas,
  CrearLoteInput,
  CrearPrendaInput,
  RegistrarVentaInput,
  RegistrarDevolucionInput,
  RangoFechas,
  ResultadoLiberarFotos,
} from './DataSource'
import type { Lote, Prenda, Venta, AnalisisVision, ResumenMes, ResumenLote, StatusPrenda } from '@/domain/types'
import { ErrorApi, ErrorRed, ErrorServidor } from './sincronizacion/tipos'

/** Ids y hora real de captura cuando el cambio se hizo sin conexión (ver sincronizacion/). */
export interface OpcionesCreacion {
  id?: string
  fecha?: string
}

const TIEMPO_JSON_MS = 10_000
const TIEMPO_SUBIDA_MS = 45_000

export const TOKEN_KEY = 'bazar_api_token'
/** Mismo nombre que `cacheName` del service worker en vite.config.ts. */
export const CACHE_FOTOS = 'bazaria-fotos'

/**
 * DataSource que consume el backend real vía el contrato REST documentado en
 * docs/es/api-contract.md en la raíz del repo (backend en Python/FastAPI en
 * backend/, ver docs/es/backend-spec.md).
 * El login con Google lo hace AuthGate: el backend redirige con el token en el fragmento.
 */
export class ApiDataSource implements DataSource {
  private baseUrl: string
  private token: string | null = null

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    try {
      this.token = localStorage.getItem(TOKEN_KEY)
    } catch {
      this.token = null
    }
  }

  private async request<T>(path: string, options: RequestInit = {}, tiempoMs?: number): Promise<T> {
    const headers = new Headers(options.headers)
    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`)
    }
    const esSubida = options.body instanceof FormData
    if (!esSubida && options.body) {
      headers.set('Content-Type', 'application/json')
    }

    // Sin tiempo límite, una red "a medias" deja la pantalla colgada sin decir nada.
    const control = new AbortController()
    const reloj = setTimeout(() => control.abort(), tiempoMs ?? (esSubida ? TIEMPO_SUBIDA_MS : TIEMPO_JSON_MS))

    let respuesta: Response
    try {
      respuesta = await fetch(`${this.baseUrl}${path}`, { ...options, headers, signal: control.signal })
    } catch {
      throw new ErrorRed()
    } finally {
      clearTimeout(reloj)
    }

    if (respuesta.status === 401) {
      this.token = null
      try {
        localStorage.removeItem(TOKEN_KEY)
      } catch {
        // noop
      }
      window.location.reload() // el login se muestra al recargar
      throw new ErrorApi('Sesión expirada', 401)
    }

    // Errores del servidor (5xx): puede ser un reinicio; se trata como "sin red" y se reintenta.
    if (respuesta.status >= 500) {
      throw new ErrorServidor(respuesta.status)
    }

    if (!respuesta.ok) {
      const cuerpo = (await respuesta.json().catch(() => null)) as {
        error?: { codigo?: string; mensaje?: string }
      } | null
      const detalle = cuerpo?.error
      const mensaje =
        respuesta.status === 429 && !detalle?.mensaje
          ? 'Llegaste al límite de análisis de hoy, captura manual'
          : (detalle?.mensaje ?? `Error ${respuesta.status}`)
      throw new ErrorApi(mensaje, respuesta.status, detalle?.codigo)
    }

    if (respuesta.status === 204) {
      return undefined as T
    }

    return respuesta.json() as Promise<T>
  }

  // --- Auth ---

  async logout(): Promise<void> {
    this.token = null
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      // noop
    }
    // Las fotos que guardó el service worker (caché "bazaria-fotos", 60 días) no deben
    // quedarse en el teléfono de una cuenta que cerró sesión o se eliminó.
    try {
      if (typeof caches !== 'undefined') await caches.delete(CACHE_FOTOS)
    } catch {
      // noop: sin Cache Storage no hay nada que borrar
    }
  }

  /** Soft delete en el backend (30 días de gracia). Después se limpia el token local. */
  async eliminarCuenta(): Promise<void> {
    await this.request<void>('/auth/me', { method: 'DELETE' })
    await this.logout()
  }

  /** El backend sube la versión de sesión: todos los tokens (todos los dispositivos) dejan de valer. */
  async cerrarSesionEnTodos(): Promise<void> {
    await this.request<void>('/auth/cerrar-sesiones', { method: 'POST' })
    await this.logout()
  }

  /** ¿Hay un token guardado en este dispositivo? (No dice si sigue vigente.) */
  tieneSesion(): boolean {
    return this.token !== null
  }

  /** Como usuariaActual, pero deja pasar el error de red: sin conexión no es "sin sesión". */
  async usuariaActualEstricto(): Promise<Usuaria | null> {
    if (!this.token) return null
    return this.request<Usuaria>('/auth/me')
  }

  async usuariaActual(): Promise<Usuaria | null> {
    try {
      return await this.usuariaActualEstricto()
    } catch {
      return null
    }
  }

  // --- Lotes ---

  async listarLotes(): Promise<Lote[]> {
    return this.request<Lote[]>('/lotes')
  }

  async crearLote(data: CrearLoteInput, opciones?: OpcionesCreacion): Promise<Lote> {
    const cuerpo = opciones?.id ? { ...data, id: opciones.id } : data
    return this.request<Lote>('/lotes', { method: 'POST', body: JSON.stringify(cuerpo) })
  }

  async actualizarLote(id: string, data: Partial<CrearLoteInput>): Promise<Lote> {
    return this.request<Lote>(`/lotes/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
  }

  async eliminarLote(id: string): Promise<void> {
    await this.request(`/lotes/${id}`, { method: 'DELETE' })
  }

  // --- Prendas ---

  async listarPrendas(filtros?: FiltrosPrendas): Promise<Prenda[]> {
    const params = new URLSearchParams()
    if (filtros?.status) params.set('status', filtros.status)
    if (filtros?.tipo) params.set('tipo', filtros.tipo)
    if (filtros?.talla) params.set('talla', filtros.talla)
    if (filtros?.loteId) params.set('loteId', filtros.loteId)
    if (filtros?.texto) params.set('texto', filtros.texto)
    const query = params.toString()
    return this.request<Prenda[]>(`/prendas${query ? `?${query}` : ''}`)
  }

  async obtenerPrenda(id: string): Promise<Prenda | null> {
    try {
      return await this.request<Prenda>(`/prendas/${id}`)
    } catch {
      return null
    }
  }

  async crearPrenda(data: CrearPrendaInput, foto: Blob, opciones?: OpcionesCreacion): Promise<Prenda> {
    const formData = new FormData()
    formData.append('foto', foto, 'foto.jpg')
    const cuerpo = { ...data, ...(opciones?.id ? { id: opciones.id } : {}), ...(opciones?.fecha ? { creadoEn: opciones.fecha } : {}) }
    formData.append('data', JSON.stringify(cuerpo))
    return this.request<Prenda>('/prendas', { method: 'POST', body: formData })
  }

  async actualizarPrenda(id: string, data: Partial<CrearPrendaInput>): Promise<Prenda> {
    return this.request<Prenda>(`/prendas/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
  }

  async liberarFotos(ids?: string[]): Promise<ResultadoLiberarFotos> {
    return this.request<ResultadoLiberarFotos>('/prendas/liberar-fotos', {
      method: 'POST',
      body: JSON.stringify(ids ? { ids } : {}),
    })
  }

  async eliminarPrenda(id: string): Promise<void> {
    await this.request(`/prendas/${id}`, { method: 'DELETE' })
  }

  async cambiarStatus(id: string, status: StatusPrenda): Promise<Prenda> {
    return this.request<Prenda>(`/prendas/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  }

  // --- Ventas ---

  async registrarVenta(prendaId: string, data: RegistrarVentaInput, opciones?: OpcionesCreacion): Promise<Venta> {
    const cuerpo = { ...data, ...(opciones?.id ? { id: opciones.id } : {}), ...(opciones?.fecha ? { fechaVenta: opciones.fecha } : {}) }
    return this.request<Venta>(`/prendas/${prendaId}/venta`, {
      method: 'POST',
      body: JSON.stringify(cuerpo),
    })
  }

  async listarVentas(rango?: RangoFechas): Promise<Venta[]> {
    const params = new URLSearchParams()
    if (rango) {
      params.set('desde', rango.desde)
      params.set('hasta', rango.hasta)
    }
    const query = params.toString()
    return this.request<Venta[]>(`/ventas${query ? `?${query}` : ''}`)
  }

  async deshacerVenta(ventaId: string): Promise<void> {
    await this.request(`/ventas/${ventaId}`, { method: 'DELETE' })
  }

  async registrarDevolucion(ventaId: string, data: RegistrarDevolucionInput, opciones?: { fecha?: string }): Promise<Venta> {
    return this.request<Venta>(`/ventas/${ventaId}/devolucion`, {
      method: 'POST',
      body: JSON.stringify({ ...data, ...(opciones?.fecha ? { fechaDevolucion: opciones.fecha } : {}) }),
    })
  }

  // --- IA ---

  async analizarFoto(foto: Blob): Promise<AnalisisVision | null> {
    const formData = new FormData()
    formData.append('foto', foto)
    try {
      // Es un extra: no vale la pena hacer esperar a quien captura una prenda.
      return await this.request<AnalisisVision>('/ia/analizar-foto', { method: 'POST', body: formData }, 12_000)
    } catch {
      return null
    }
  }

  // --- Reportes ---

  async resumenMes(anio: number, mes: number): Promise<ResumenMes> {
    return this.request<ResumenMes>(`/reportes/resumen-mes?anio=${anio}&mes=${mes}`)
  }

  async resumenLote(loteId: string): Promise<ResumenLote> {
    return this.request<ResumenLote>(`/reportes/resumen-lote/${loteId}`)
  }
}
