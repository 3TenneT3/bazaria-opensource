import { useState } from 'react'
import { Link } from 'react-router-dom'

const CLAVE = 'bazaria_aviso_cookies'

function yaVisto(): boolean {
  try {
    return localStorage.getItem(CLAVE) === '1'
  } catch {
    return false
  }
}

/**
 * Aviso informativo. Bazaria solo usa almacenamiento estrictamente necesario (sesión,
 * tema y la cookie temporal del inicio de sesión con Google) y no usa analítica ni
 * publicidad, así que no hay nada que aceptar o rechazar: solo se informa y se enlaza
 * a la política. Si algún día se agrega analítica, aquí hay que pedir consentimiento.
 */
export function AvisoCookies() {
  const [visible, setVisible] = useState(() => !yaVisto())
  if (!visible) return null

  function entendido() {
    try {
      localStorage.setItem(CLAVE, '1')
    } catch {
      // sin localStorage el aviso reaparece en la próxima visita; no pasa nada
    }
    setVisible(false)
  }

  return (
    <div
      role="region"
      aria-label="Aviso de cookies"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-xl flex-col gap-3 rounded-2xl border-2 border-lila-500 bg-white p-4 text-sm text-tinta shadow-lg sm:flex-row sm:items-center dark:bg-superficie-dark dark:text-tinta-dark"
    >
      <p className="flex-1 leading-snug">
        Usamos solo cookies y almacenamiento <b>esenciales</b> para tu sesión y tus preferencias. No usamos publicidad ni
        analítica.{' '}
        <Link to="/cookies" className="font-semibold text-lila-600 underline dark:text-lila-300">
          Más información
        </Link>
      </p>
      <button
        onClick={entendido}
        className="min-h-11 shrink-0 rounded-xl bg-lila-600 px-5 font-semibold text-white hover:bg-lila-700"
      >
        Entendido
      </button>
    </div>
  )
}
