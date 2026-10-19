import type { ReactNode } from 'react'

interface EstadoVacioProps {
  icono?: ReactNode
  titulo: string
  descripcion: string
  accion?: ReactNode
}

export function EstadoVacio({ icono, titulo, descripcion, accion }: EstadoVacioProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-white/60 px-6 py-12 text-center dark:bg-superficie-dark">
      {icono && <div className="text-lila-500">{icono}</div>}
      <h3 className="font-display text-lg font-bold">{titulo}</h3>
      <p className="max-w-xs text-sm text-tinta/70 dark:text-tinta-dark/70">{descripcion}</p>
      {accion}
    </div>
  )
}
