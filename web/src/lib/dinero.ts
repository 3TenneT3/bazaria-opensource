/** Formatea centavos como dinero MXN: $1,250.00 */
export function formatearMXN(centavos: number): string {
  const pesos = centavos / 100
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(pesos)
}

/** Convierte un string de pesos (ej. del input) a centavos enteros. */
export function pesosACentavos(pesos: string | number): number {
  const valor = typeof pesos === 'string' ? parseFloat(pesos.replace(/,/g, '')) : pesos
  if (Number.isNaN(valor)) return 0
  return Math.round(valor * 100)
}

/** Convierte centavos a un string de pesos simple, sin símbolo, para inputs. */
export function centavosAPesosInput(centavos: number): string {
  return (centavos / 100).toFixed(2)
}

/** Tope del campo de captura: $99,999,999.99 (evita números que ya no caben en el campo). */
const MAX_CENTAVOS = 9_999_999_999

/**
 * Captura "estilo cajero/banco": cada dígito entra por la derecha y empuja a los demás.
 * Teclear 5, 5, 5 da $0.05 → $0.55 → $5.55. Borrar quita el último dígito.
 * Ignora todo lo que no sea dígito (el punto y las comas del formato).
 */
export function centavosDesdeTecleo(texto: string): number {
  const digitos = texto.replace(/\D/g, '').replace(/^0+/, '')
  if (!digitos) return 0
  return Math.min(Number(digitos), MAX_CENTAVOS)
}

/** Formato del campo de captura: 1,234.56 (siempre con dos decimales). */
export function formatoCaptura(centavos: number): string {
  return (centavos / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
