import { Link } from 'react-router-dom'
import { ETIQUETA_VERSION } from '@/lib/version'

/** Pie común de las páginas públicas (info y legales). */
export function PieSitio() {
  return (
    <footer className="border-t border-black/10 py-8 text-sm text-tinta/70 dark:border-white/10 dark:text-tinta-dark/70">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-5 sm:flex-row sm:justify-between">
        <p>© {new Date().getFullYear()} Bazaria · {ETIQUETA_VERSION} · Software de código abierto (MIT)</p>
        <nav aria-label="Información legal" className="flex flex-wrap justify-center gap-x-5 gap-y-2 font-semibold">
          <Link to="/" className="hover:underline">Inicio</Link>
          <Link to="/privacidad" className="hover:underline">Aviso de privacidad</Link>
          <Link to="/terminos" className="hover:underline">Términos</Link>
          <Link to="/cookies" className="hover:underline">Cookies</Link>
        </nav>
      </div>
    </footer>
  )
}
