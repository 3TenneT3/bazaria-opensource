import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: 'primario' | 'secundario' | 'peligro' | 'fantasma'
  children: ReactNode
}

const variantes: Record<NonNullable<BotonProps['variante']>, string> = {
  primario:
    'bg-lila-600 text-white hover:bg-lila-700 active:bg-lila-700 dark:bg-lila-600 dark:hover:bg-lila-700',
  secundario:
    'bg-lila-50 text-lila-700 hover:bg-lila-100 dark:bg-white/10 dark:text-lila-100 dark:hover:bg-white/15',
  peligro: 'bg-perdida text-white hover:brightness-95 dark:text-tinta',
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
