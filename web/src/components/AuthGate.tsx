import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { esModoDemo, getDataSource } from '@/data'
import { TOKEN_KEY } from '@/data/ApiDataSource'
import { useTema } from '@/components/TemaProvider'
import { DECORACION, POSICIONES } from '@/lib/decoracion'

const API = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

type EstadoSesion = 'cargando' | 'dentro' | 'fuera'
const SesionContext = createContext<EstadoSesion>('cargando')

/**
 * Resuelve la sesión una sola vez. En modo api: el backend hace el OAuth con Google y regresa
 * a la app con `#token=...` en el fragmento (no viaja al servidor ni a logs). En demo siempre
 * hay sesión. Las rutas públicas (/info, /login) no dependen de este estado para mostrarse.
 */
export function SesionProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoSesion>(esModoDemo ? 'dentro' : 'cargando')
  const navigate = useNavigate()

  useEffect(() => {
    if (esModoDemo) return
    const hash = new URLSearchParams(window.location.hash.slice(1))
    const token = hash.get('token')
    // El backend regresa a la raíz (landing) también cuando falla el login: lo llevamos a /login con el aviso.
    if (hash.get('error') && window.location.pathname === '/') {
      navigate(`/login#error=${encodeURIComponent(hash.get('error') ?? '')}`, { replace: true })
    }
    if (token) {
      try {
        localStorage.setItem(TOKEN_KEY, token)
      } catch {
        // sin localStorage la sesión no persiste; igual se intenta con este token en memoria
      }
      history.replaceState(null, '', window.location.pathname)
    }
    getDataSource()
      .usuariaActual()
      .then((u) => {
        setEstado(u ? 'dentro' : 'fuera')
        // El backend regresa del OAuth a la raíz (la landing): con sesión nueva, directo a la app.
        if (token && u) navigate('/app', { replace: true })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <SesionContext.Provider value={estado}>{children}</SesionContext.Provider>
}

export function useSesion(): EstadoSesion {
  return useContext(SesionContext)
}

function Cargando() {
  return <div className="py-20 text-center text-tinta/70 dark:text-tinta-dark/70">Cargando…</div>
}

/** Envuelve las rutas de la app: sin sesión manda a /login. */
export function RutaProtegida() {
  const estado = useSesion()
  if (estado === 'cargando') return <Cargando />
  if (estado === 'fuera') return <Navigate to="/login" replace />
  return <Outlet />
}

export function PantallaLogin() {
  const estado = useSesion()
  const { skin, tema } = useTema()
  const deco = DECORACION[skin]
  const huboError = new URLSearchParams(window.location.hash.slice(1)).has('error')

  if (estado === 'cargando') return <Cargando />
  if (estado === 'dentro') return <Navigate to="/app" replace />

  return (
    <div className="bg-libreta sin-stickers relative flex min-h-svh flex-col items-center justify-center gap-8 overflow-hidden px-6 text-center">
      {deco?.esquinas.map((e, i) => {
        const src = typeof e === 'string' ? e : e[tema === 'claro' ? 0 : 1]
        return <img key={i} src={src} alt="" className={`pointer-events-none absolute object-contain ${POSICIONES[i]}`} />
      })}

      <div className="relative z-10 flex flex-col items-center gap-5">
        {deco && <img src={deco.mascota} alt={deco.nombre ?? ''} title={deco.nombre} className="h-44 w-44 object-contain sm:h-52 sm:w-52" />}
        <div>
          <h1 className="font-display text-5xl font-bold tracking-tight text-lila-600 dark:text-lila-300">Bazaria</h1>
          <p className="mx-auto mt-3 max-w-xs text-lg font-semibold">
            Cuánto te costó. Cuánto ganas de verdad.
          </p>
        </div>
      </div>

      <div className="relative z-10 flex w-full max-w-xs flex-col gap-3">
        {huboError && (
          <p role="alert" className="rounded-xl bg-rosa-100 px-3 py-2 text-sm font-semibold text-tinta">
            No pudimos iniciar tu sesión con esa cuenta de Google. Intenta de nuevo.
          </p>
        )}
        <button
          onClick={() => (window.location.href = `${API}/auth/google`)}
          className="flex min-h-12 items-center justify-center gap-3 rounded-2xl border-2 border-lila-500 bg-white px-5 py-3 font-semibold text-tinta transition-colors hover:bg-lila-50 dark:bg-superficie-dark dark:text-tinta-dark dark:hover:bg-white/10"
        >
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.7 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.6 17.7 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/>
            <path fill="#FBBC05" d="M10.4 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.8-6.1z"/>
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.7-4.1-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48z"/>
          </svg>
          Continuar con Google
        </button>
        <p className="text-xs text-tinta/70 dark:text-tinta-dark/70">
          Solo usamos tu correo para identificarte. Tu inventario es solo tuyo.
        </p>
        <Link to="/" className="text-sm font-semibold text-lila-600 underline-offset-2 hover:underline dark:text-lila-300">
          ¿Qué es Bazaria?
        </Link>
        <p className="text-xs text-tinta/70 dark:text-tinta-dark/70">
          Al continuar aceptas los <Link to="/terminos" className="underline">Términos</Link> y el{' '}
          <Link to="/privacidad" className="underline">Aviso de privacidad</Link>.
        </p>
      </div>
    </div>
  )
}
