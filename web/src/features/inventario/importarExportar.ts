import * as XLSX from 'xlsx'
import { hojaConFormato } from '@/lib/excel'
import type { EstadoPrenda, Prenda } from '@/domain/types'
import type { CrearPrendaInput } from '@/data/DataSource'

// Mismas columnas en plantilla, exportación e importación: lo que exportas se puede volver a importar.
// "Talla o medida" sirve para ropa y para lo demás (tazas, vasijas, muñecos…).
const COL_TALLA = 'Talla o medida'
const COLUMNAS = ['Tipo', 'Color', COL_TALLA, 'Marca', 'Estado', 'Costo', 'Precio de venta'] as const
// Plantillas y exportaciones viejas usaban "Talla": se siguen aceptando al importar.
const ALIAS: Record<string, string[]> = { [COL_TALLA]: [COL_TALLA, 'Talla'] }
const ESTADOS: EstadoPrenda[] = ['nueva', 'seminueva', 'usada']
const TIPOS_FOTO = ['blusa', 'pantalon', 'vestido', 'falda', 'chamarra']

function guardar(
  filas: Record<string, string | number>[],
  nombre: string,
  encabezados: string[],
  instrucciones = false,
) {
  const libro = XLSX.utils.book_new()
  // Costo y Precio como número con formato de pesos: se pueden sumar y se vuelven a importar igual.
  const hoja = hojaConFormato(filas, { encabezados, moneda: ['Costo', 'Precio de venta'] })
  XLSX.utils.book_append_sheet(libro, hoja, 'Inventario')
  if (instrucciones) {
    XLSX.utils.book_append_sheet(
      libro,
      XLSX.utils.aoa_to_sheet([
        ['Cómo llenar la plantilla'],
        ['Una prenda o artículo por renglón en la hoja "Inventario". Borra el renglón de ejemplo.'],
        ['Tipo: obligatorio (blusa, pantalón, vestido… o taza, vasija, muñeco, tote…).'],
        ['Estado: nueva, seminueva o usada (si lo dejas vacío se toma "usada").'],
        ['Costo y Precio de venta: en pesos, solo número (ej. 85 o 120.50).'],
        ['Color, Talla o medida y Marca son opcionales.'],
        ['La columna Status (solo en exportaciones) se ignora al importar: todo entra como "disponible".'],
      ]),
      'Instrucciones',
    )
  }
  XLSX.writeFile(libro, nombre)
}

export function descargarPlantilla(): void {
  guardar(
    [{ Tipo: 'blusa', Color: 'lila', [COL_TALLA]: 'M', Marca: 'Zara', Estado: 'seminueva', Costo: 25, 'Precio de venta': 80 }],
    'plantilla-inventario.xlsx',
    [...COLUMNAS],
    true,
  )
}

export function exportarInventario(prendas: Prenda[]): void {
  guardar(
    prendas.map((p) => ({
      Tipo: p.tipo ?? '',
      Color: p.color ?? '',
      [COL_TALLA]: p.talla ?? '',
      Marca: p.marca ?? '',
      Estado: p.estado,
      Costo: p.costo / 100,
      'Precio de venta': p.precioVenta / 100,
      Status: p.status,
    })),
    `inventario-${new Date().toISOString().slice(0, 10)}.xlsx`,
    [...COLUMNAS, 'Status'],
  )
}

function aCentavos(v: unknown): number | null {
  if (v === '' || v == null) return 0
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[$,\s]/g, ''))
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null
}

export interface ResultadoImportacion {
  prendas: CrearPrendaInput[]
  errores: string[]
}

export async function leerInventario(archivo: File): Promise<ResultadoImportacion> {
  const libro = XLSX.read(await archivo.arrayBuffer())
  const hoja = libro.Sheets['Inventario'] ?? libro.Sheets[libro.SheetNames[0]]
  const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: '' })
  const prendas: CrearPrendaInput[] = []
  const errores: string[] = []

  filas.forEach((f, i) => {
    const renglon = i + 2 // el renglón 1 son los encabezados
    const texto = (k: string) => {
      for (const nombre of ALIAS[k] ?? [k]) {
        const v = String(f[nombre] ?? '').trim()
        if (v) return v
      }
      return ''
    }
    if (!COLUMNAS.some((c) => texto(c))) return // renglón vacío
    const tipo = texto('Tipo')
    const estado = (texto('Estado').toLowerCase() || 'usada') as EstadoPrenda
    const costoRaw = f['Costo']
    const costo = aCentavos(costoRaw)
    const precio = aCentavos(f['Precio de venta'])

    if (!tipo) return void errores.push(`Renglón ${renglon}: falta el Tipo`)
    if (!ESTADOS.includes(estado)) return void errores.push(`Renglón ${renglon}: Estado "${texto('Estado')}" no válido`)
    if (costo === null || precio === null) return void errores.push(`Renglón ${renglon}: Costo o Precio no es un número`)

    prendas.push({
      loteId: null,
      tipo,
      color: texto('Color') || null,
      talla: texto(COL_TALLA) || null,
      marca: texto('Marca') || null,
      estado,
      costo,
      costoManual: costoRaw !== '' && costoRaw != null,
      precioVenta: precio,
    })
  })
  return { prendas, errores }
}

/** Foto de relleno para prendas importadas: la foto del seed del mismo tipo, o un blob vacío. */
export async function fotoPlaceholder(tipo: string | null): Promise<Blob> {
  const t = (tipo ?? '').toLowerCase()
  const i = Math.max(0, TIPOS_FOTO.findIndex((k) => t.startsWith(k.slice(0, 5))))
  try {
    const r = await fetch(`/demo/prenda-${String(i + 1).padStart(2, '0')}-${TIPOS_FOTO[i]}.webp`)
    if (r.ok) return await r.blob()
  } catch {
    // sin red ni caché: cae al blob vacío
  }
  return new Blob([], { type: 'image/png' })
}
