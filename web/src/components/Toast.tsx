import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface Toast {
  id: number
  mensaje: string
  accion?: { etiqueta: string; onClick: () => void }
}

interface ToastContextValor {
  mostrarToast: (mensaje: string, accion?: Toast['accion']) => void
}

const ToastContext = createContext<ToastContextValor | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const idRef = useRef(0)

  const mostrarToast = useCallback((mensaje: string, accion?: Toast['accion']) => {
    const id = idRef.current++
    setToasts((prev) => [...prev, { id, mensaje, accion }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 5000)
  }, [])

  return (
    <ToastContext.Provider value={{ mostrarToast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex max-w-sm items-center gap-3 rounded-2xl bg-tinta px-4 py-3 text-sm text-crema shadow-lg dark:bg-white dark:text-tinta"
          >
            <span>{toast.mensaje}</span>
            {toast.accion && (
              <button
                onClick={toast.accion.onClick}
                className="font-semibold text-lila-300 dark:text-lila-600"
              >
                {toast.accion.etiqueta}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValor {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider')
  return ctx
}
