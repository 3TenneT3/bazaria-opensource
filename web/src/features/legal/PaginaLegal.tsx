import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PieSitio } from '@/components/PieSitio'
import { FECHA_ACTUALIZACION } from './responsable'

export function useTitulo(titulo: string): void {
  useEffect(() => {
    const anterior = document.title
    document.title = titulo
    return () => {
      document.title = anterior
    }
  }, [titulo])
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="mt-10 font-display text-xl font-bold text-lila-700 dark:text-lila-300">{children}</h2>
}
export function P({ children }: { children: ReactNode }) {
  return <p className="mt-3 leading-relaxed">{children}</p>
}
export function UL({ children }: { children: ReactNode }) {
  return <ul className="mt-3 list-disc space-y-1.5 pl-5 leading-relaxed">{children}</ul>
}

export function PaginaLegal({ titulo, children }: { titulo: string; children: ReactNode }) {
  useTitulo(`${titulo} · Bazaria`)
  return (
    <div className="bg-libreta flex min-h-svh flex-col">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-5">
        <Link to="/" className="font-display text-xl font-bold text-lila-600 dark:text-lila-300">
          Bazaria
        </Link>
        <Link to="/login" className="text-sm font-semibold text-lila-600 hover:underline dark:text-lila-300">
          Entrar
        </Link>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-16">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{titulo}</h1>
        <p className="mt-2 text-sm text-tinta/70 dark:text-tinta-dark/70">Última actualización: {FECHA_ACTUALIZACION}</p>
        {children}
      </main>
      <PieSitio />
    </div>
  )
}
