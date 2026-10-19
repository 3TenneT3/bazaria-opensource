import { useEffect, useState } from 'react'
import { RotateCcw, Sun, Moon, Settings, Check } from 'lucide-react'
import { reiniciarDemo } from '@/data/DemoDataSource'
import { useToast } from './Toast'
import { useTema, SKINS } from './TemaProvider'
import { BottomSheet } from './BottomSheet'
import { esModoDemo, getDataSource } from '@/data'
import { ETIQUETA_VERSION } from '@/lib/version'
import { descartarAvisos, useEstadoSync } from '@/data/sincronizacion/estado'
import { useVocabulario } from '@/components/Vocabulario'

export function DemoBanner() {
  const { modo, setModo } = useVocabulario()
  const [reiniciando, setReiniciando] = useState(false)
  const [ajustes, setAjustes] = useState(false)
  const { mostrarToast } = useToast()
  const { tema, alternarTema, skin, setSkin } = useTema()
  const sync = useEstadoSync()

  // Cambios que el servidor rechazó al subirlos (p. ej. prenda ya vendida en otro dispositivo).
  useEffect(() => {
    if (sync.avisos.length === 0) return
    sync.avisos.forEach((a) => mostrarToast(a))
    descartarAvisos()
  }, [sync.avisos, mostrarToast])

  function textoEstado(): string {
    if (esModoDemo) return `Demo ${ETIQUETA_VERSION} · tus datos solo se guardan en este navegador`
    const n = sync.pendientes
    const cambios = `${n} cambio${n === 1 ? '' : 's'}`
    if (sync.sinConexion) {
      return n > 0
        ? `Sin conexión · ${cambios} por subir`
        : 'Sin conexión · lo que captures se sube al reconectar'
    }
    if (sync.atorados > 0) return `${sync.atorados} cambio${sync.atorados === 1 ? '' : 's'} sin poder subir · se reintenta`
    if (n > 0) return sync.sincronizando ? `Subiendo ${cambios}…` : `${cambios} por subir`
    return `${ETIQUETA_VERSION} · todo guardado`
  }

  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false)
  const [textoBorrado, setTextoBorrado] = useState('')
  const [borrando, setBorrando] = useState(false)

  async function manejarEliminarCuenta() {
    if (borrando) return
    setBorrando(true)
    try {
      await getDataSource().eliminarCuenta() // limpia el token; AuthGate pedirá login al recargar
      window.location.assign('/')
    } catch {
      mostrarToast('No se pudo eliminar la cuenta. Intenta de nuevo.')
      setBorrando(false)
    }
  }

  async function manejarReinicio() {
    if (reiniciando) return
    setReiniciando(true)
    try {
      await reiniciarDemo()
      mostrarToast('Demo reiniciada. Recargando…')
      setTimeout(() => window.location.assign('/app'), 800)
    } catch {
      mostrarToast('No se pudo reiniciar la demo. Intenta de nuevo.')
      setReiniciando(false)
    }
  }

  return (
    <div className="sticky top-0 z-40 flex items-center justify-between gap-2 bg-lila-50 px-4 py-2 text-xs text-lila-700 dark:bg-superficie-dark dark:text-lila-100">
      <span className="min-w-0 flex-1 truncate">
        {textoEstado()}
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={alternarTema}
          aria-label={tema === 'claro' ? 'Activar modo oscuro' : 'Activar modo claro'}
          title={tema === 'claro' ? 'Activar modo oscuro' : 'Activar modo claro'}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white dark:bg-white/10"
        >
          {tema === 'claro' ? <Moon size={14} /> : <Sun size={14} />}
        </button>
        {esModoDemo && (
          <button
            onClick={manejarReinicio}
            disabled={reiniciando}
            className="flex min-h-11 items-center gap-1 whitespace-nowrap rounded-full bg-white px-3 py-1 font-semibold disabled:opacity-60 dark:bg-white/10"
          >
            <RotateCcw size={14} className={reiniciando ? 'animate-spin' : ''} />
            Reiniciar demo
          </button>
        )}
        <button
          onClick={() => setAjustes(true)}
          aria-label="Configuración"
          title="Configuración"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white dark:bg-white/10"
        >
          <Settings size={14} />
        </button>
      </div>
      <BottomSheet abierto={ajustes} onCerrar={() => setAjustes(false)} titulo="Configuración">
        <p className="mb-3 text-sm font-semibold text-tinta dark:text-tinta-dark">Colores</p>
        <div className="grid grid-cols-5 gap-1">
          {SKINS.filter((s) => s.grupo === 'color').map((s) => (
            <button
              key={s.id}
              onClick={() => setSkin(s.id)}
              aria-pressed={skin === s.id}
              className={`flex min-h-11 flex-col items-center gap-1.5 rounded-2xl border-2 px-0.5 py-2 text-xs font-semibold text-tinta dark:text-tinta-dark ${
                skin === s.id ? 'border-lila-500' : 'border-transparent bg-black/5 dark:bg-white/10'
              }`}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: s.color }}
              >
                {skin === s.id && <Check size={16} />}
              </span>
              {s.nombre}
            </button>
          ))}
        </div>

        <p className="mb-1 mt-6 text-sm font-semibold text-tinta dark:text-tinta-dark">Estéticas</p>
        <p className="mb-3 text-xs text-tinta/70 dark:text-tinta-dark/70">Con ilustraciones y stickers propios.</p>
        <div className="grid grid-cols-3 gap-2">
          {SKINS.filter((s) => s.grupo === 'estetica').map((s) => (
            <button
              key={s.id}
              onClick={() => setSkin(s.id)}
              aria-pressed={skin === s.id}
              className={`relative flex flex-col items-center gap-2 rounded-2xl border-2 p-3 text-sm font-semibold text-tinta dark:text-tinta-dark ${
                skin === s.id ? 'border-lila-500' : 'border-transparent bg-black/5 dark:bg-white/10'
              }`}
            >
              <img src={s.vista} alt="" className="h-16 w-16 object-contain" />
              {s.nombre}
              {skin === s.id && (
                <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-lila-500 text-white">
                  <Check size={14} />
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="mt-6 rounded-2xl bg-black/5 p-4 dark:bg-white/10">
          <p className="text-sm font-semibold text-tinta dark:text-tinta-dark">¿Vendes más que ropa?</p>
          <p className="mt-1 text-xs text-tinta/70 dark:text-tinta-dark/70">
            Bazaria neutro cambia «prendas» por «artículos» para tazas, vasijas, muñecos y todo lo que
            hay en un bazar. Tus datos no cambian.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Qué vendes">
            {(
              [
                ['ropa', 'Ropa'],
                ['general', 'De todo (neutro)'],
              ] as const
            ).map(([valor, etiqueta]) => (
              <button
                key={valor}
                role="radio"
                aria-checked={modo === valor}
                onClick={() => setModo(valor)}
                className={`flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border-2 px-3 text-sm font-semibold text-tinta dark:text-tinta-dark ${
                  modo === valor ? 'border-lila-500 bg-white dark:bg-superficie-dark' : 'border-transparent bg-white/60 dark:bg-white/5'
                }`}
              >
                {modo === valor && <Check size={14} />}
                {etiqueta}
              </button>
            ))}
          </div>
        </div>

        {!esModoDemo && (
          <button
            onClick={async () => {
              try {
                await getDataSource().logout()
                window.location.assign('/login')
              } catch (e) {
                // Con cambios sin subir no se cierra sesión: se perderían al borrar los datos locales.
                mostrarToast(e instanceof Error ? e.message : 'No se pudo cerrar la sesión.')
              }
            }}
            className="mt-5 w-full rounded-2xl bg-black/5 px-4 py-3 text-sm font-semibold text-tinta dark:bg-white/10 dark:text-tinta-dark"
          >
            Cerrar sesión
          </button>
        )}
        {!esModoDemo && (
          <button
            onClick={async () => {
              if (!window.confirm('Se cerrará tu sesión en todos tus dispositivos, también en este. ¿Continuar?')) return
              try {
                await getDataSource().cerrarSesionEnTodos()
                window.location.assign('/login')
              } catch (e) {
                mostrarToast(e instanceof Error ? e.message : 'No se pudo cerrar la sesión en todos lados.')
              }
            }}
            className="mt-2 w-full rounded-2xl px-4 py-2 text-xs font-semibold text-tinta/70 underline dark:text-tinta-dark/70"
          >
            ¿Perdiste o prestaste tu teléfono? Cerrar sesión en todos lados
          </button>
        )}
        {!esModoDemo && (
          <div className="mt-3 rounded-2xl border border-red-300 p-3 dark:border-red-400/50">
            {!confirmandoBorrado ? (
              <button
                onClick={() => setConfirmandoBorrado(true)}
                className="min-h-11 w-full text-sm font-semibold text-red-700 dark:text-red-300"
              >
                Eliminar mi cuenta
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-tinta dark:text-tinta-dark">
                  Se borrarán tus lotes, prendas, ventas y fotos. Tienes 30 días para arrepentirte: si vuelves a entrar
                  con Google antes, tu cuenta se reactiva. Escribe <b>ELIMINAR</b> para confirmar.
                </p>
                <input
                  value={textoBorrado}
                  onChange={(e) => setTextoBorrado(e.target.value)}
                  aria-label="Escribe ELIMINAR para confirmar"
                  autoComplete="off"
                  className="min-h-11 rounded-xl border border-red-300 bg-transparent px-3 text-sm text-tinta dark:text-tinta-dark"
                />
                <button
                  onClick={manejarEliminarCuenta}
                  disabled={textoBorrado.trim().toUpperCase() !== 'ELIMINAR' || borrando}
                  className="min-h-11 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {borrando ? 'Eliminando…' : 'Eliminar definitivamente'}
                </button>
                <button
                  onClick={() => {
                    setConfirmandoBorrado(false)
                    setTextoBorrado('')
                  }}
                  className="min-h-11 text-sm font-semibold text-tinta/70 dark:text-tinta-dark/70"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  )
}
