/** Formatea una fecha ISO como fecha corta en español de México. */
export function formatearFecha(iso: string): string {
  const fecha = new Date(iso)
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(fecha)
}

/** Formatea una fecha ISO como "hace X días". */
export function hace(iso: string, ahora: Date = new Date()): string {
  const fecha = new Date(iso)
  const dias = Math.floor((ahora.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24))
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'hace 1 día'
  return `hace ${dias} días`
}

/** Nombre del mes en español, dado el número de mes (1-12). */
export function nombreMes(mes: number): string {
  const fecha = new Date(2024, mes - 1, 1)
  return new Intl.DateTimeFormat('es-MX', { month: 'long' }).format(fecha)
}
