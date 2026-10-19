import { useId } from 'react'
import { centavosDesdeTecleo, formatoCaptura, pesosACentavos } from '@/lib/dinero'

interface InputDineroProps {
  label: string
  valorCentavos: number
  onChange: (centavos: number) => void
  obligatorio?: boolean
  id?: string
}

export function InputDinero({
  label,
  valorCentavos,
  onChange,
  obligatorio,
  id,
}: InputDineroProps) {
  const idGenerado = useId()
  const inputId = id ?? idGenerado

  return (
    <label htmlFor={inputId} className="flex flex-col gap-1 text-sm font-medium">
      <span>{label}</span>
      <div className="flex items-center gap-1 rounded-2xl border border-black/10 bg-white px-4 py-3 focus-within:border-lila-500 dark:border-white/10 dark:bg-superficie-dark">
        <span className="text-tinta/60 dark:text-tinta-dark/60">$</span>
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-required={obligatorio}
          value={formatoCaptura(valorCentavos)}
          // Estilo banco: cada dígito entra por la derecha (5, 5, 5 → 0.05, 0.55, 5.55).
          onChange={(e) => onChange(centavosDesdeTecleo(e.target.value))}
          // Pegar "85.50" debe dar 85.50, no 8,550: el texto pegado sí se interpreta como pesos.
          onPaste={(e) => {
            e.preventDefault()
            onChange(Math.min(pesosACentavos(e.clipboardData.getData('text').replace(/[^\d.,]/g, '')), 9_999_999_999))
          }}
          // El cursor siempre al final: no tiene sentido editar a la mitad un número que se recorre.
          onFocus={(e) => {
            const el = e.currentTarget
            requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length))
          }}
          onClick={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
          className="min-h-11 w-full bg-transparent text-base outline-none"
        />
      </div>
    </label>
  )
}
