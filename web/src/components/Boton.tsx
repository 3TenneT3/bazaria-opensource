import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: 'primario' | 'secundario' | 'peligro' | 'fantasma'
  children: ReactNode
}

const variantes: Record<NonNullable<BotonProps['variante']>, string> = {
  primario:
    'bg-lila-500 text-white hover:bg-lila-600 active:bg-lila-700 dark:bg-lila-500 dark:hover:bg-lila-600',
  secundario:
    'bg-lila-50 text-lila-700 hover:bg-lila-100 dark:bg-white/10 dark:text-lila-100 dark:hover:bg-white/15',
  peligro: 'bg-rosa-500 text-white hover:brightness-95',
  fantasma: 'bg-transparent text-tinta hover:bg-black/5 dark:text-tinta-dark dark:hover:bg-white/10',
}

export function Boton({ variante = 'primario', className = '', children, ...props }: BotonProps) {
  return (
    <button
      className={`min-h-11 min-w-11 rounded-2xl px-5 py-3 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variantes[variante]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
