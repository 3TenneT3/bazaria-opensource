import { Link } from 'react-router-dom'
import { useTitulo } from '@/features/legal/PaginaLegal'

export function NoEncontrada() {
  useTitulo('Página no encontrada · Bazaria')
  return (
    <div className="bg-libreta flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-display text-6xl font-bold text-lila-600 dark:text-lila-300">404</p>
      <h1 className="font-display text-2xl font-bold">No encontramos esta página</h1>
      <p className="text-tinta/80 dark:text-tinta-dark/80">Puede que el enlace esté mal escrito o que ya no exista.</p>
      <div className="mt-2 flex gap-3">
        <Link to="/" className="flex min-h-12 items-center rounded-2xl bg-lila-600 px-6 font-semibold text-white hover:bg-lila-700">
          Ir al inicio
        </Link>
        <Link to="/info" className="flex min-h-12 items-center rounded-2xl border-2 border-lila-500 px-6 font-semibold">
          Qué es Bazaria
        </Link>
      </div>
    </div>
  )
}
