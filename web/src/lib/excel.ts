import * as XLSX from 'xlsx'

/** Formato de moneda en pesos que Excel entiende como número (se puede sumar y graficar). */
export const FORMATO_MONEDA = '"$"#,##0.00'
/** Fecha real de Excel (se puede ordenar y filtrar), mostrada como 19/10/2026. */
export const FORMATO_FECHA = 'dd/mm/yyyy'

/** Centavos -> pesos como número (no texto): 12050 -> 120.5. */
export function pesos(centavos: number): number {
  return Math.round(centavos) / 100
}

/**
 * Fecha ISO -> Date a medianoche LOCAL del día que ve la usuaria. Así Excel muestra el mismo día
 * que la app aunque la venta se haya registrado de noche (en UTC ya sería el día siguiente).
 */
export function fechaExcel(iso: string): Date | string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/**
 * Crea una hoja a partir de filas y aplica formato de moneda y de fecha a las columnas indicadas
 * (por nombre de encabezado). Los valores deben venir ya como número (pesos) o Date.
 */
export function hojaConFormato(
  filas: Record<string, string | number | Date>[],
  opciones: { encabezados?: string[]; moneda?: string[]; fecha?: string[]; ancho?: number } = {},
): XLSX.WorkSheet {
  const encabezados = opciones.encabezados ?? (filas[0] ? Object.keys(filas[0]) : [])
  const hoja = XLSX.utils.json_to_sheet(filas, { header: encabezados, cellDates: false, dateNF: FORMATO_FECHA })
  const formatos = new Map<number, string>()
  encabezados.forEach((h, i) => {
    if (opciones.moneda?.includes(h)) formatos.set(i, FORMATO_MONEDA)
    if (opciones.fecha?.includes(h)) formatos.set(i, FORMATO_FECHA)
  })
  for (let r = 1; r <= filas.length; r++) {
    for (const [c, z] of formatos) {
      const celda = hoja[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined
      if (celda && celda.t === 'n') celda.z = z
    }
  }
  hoja['!cols'] = encabezados.map(() => ({ wch: opciones.ancho ?? 16 }))
  return hoja
}
