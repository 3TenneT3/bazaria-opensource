import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface BottomSheetProps {
  abierto: boolean
  onCerrar: () => void
  titulo: string
  children: ReactNode
}

export function BottomSheet({ abierto, onCerrar, titulo, children }: BottomSheetProps) {
  if (!abierto) return null

  // Portal a <body>: si no, el z-50 queda atrapado en el contexto del contenedor (p. ej. el banner sticky)
  // y la barra de navegación lo tapa.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <button
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/30"
        onClick={onCerrar}
      />
      <div className="relative z-10 max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-[2rem] md:rounded-[2rem] bg-crema p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl dark:bg-crema-dark">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{titulo}</h2>
          <button
            aria-label="Cerrar"
            onClick={onCerrar}
            className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
