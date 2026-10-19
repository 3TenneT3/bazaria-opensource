import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

/**
 * Vocabulario de la app. "ropa" es el original; "general" (Bazaria neutro) es para
 * quien vende de todo en el bazar: tazas, vasijas, muñecos, etc. Solo cambian las
 * palabras de la interfaz; los datos y la API son los mismos.
 *
 * Las frases van completas (no se arman con piezas) porque "prenda" es femenino y
 * "artículo" masculino: "¡Prenda guardada!" / "¡Artículo guardado!".
 */
export type ModoVocabulario = 'ropa' | 'general'

const FRASES = {
  ropa: {
    item: 'prenda',
    items: 'prendas',
    Item: 'Prenda',
    Items: 'Prendas',
    unItem: 'una prenda',
    tuPrimerItem: 'tu primera prenda',
    elItem: 'la prenda',
    agregarItem: 'Agregar prenda',
    agregaUnItem: 'Agrega una prenda',
    itemGuardado: '¡Prenda guardada!',
    itemDescartado: 'Prenda descartada',
    itemApartado: 'Prenda apartada',
    noEncontramosItems: 'No encontramos prendas',
    itemsDisponibles: 'Prendas disponibles',
    itemsVendidos: 'Prendas vendidas',
    costoPorItem: 'Costo por prenda',
    itemsDeEsteLote: 'Prendas de este lote',
    dineroParado: 'Dinero parado en ropa',
    talla: 'Talla',
    nuevoLote: 'Nuevo lote o paca',
    ejemploLote: 'Ej. Paca Nike 100 camisas',
    loteVacio: 'Registra una paca o compra para repartir el costo entre tus prendas.',
    ayudaLoteSinLotes: 'Si viene de una paca, crea el lote y el costo se reparte solo.',
    ayudaLoteConLotes: 'Elige la paca de donde salió, o escribe lo que te costó suelta.',
    ayudaLoteVacio: 'Toma la foto de cada prenda que venía en la paca. El costo se reparte solo entre ellas.',
    repartoLote: 'El costo se reparte solo entre las prendas que agregues a este lote.',
    sinVentas: 'Cuando marques una prenda como vendida, aparecerá aquí.',
    reconociendo: 'Reconociendo la prenda…',
    noEncontramosEste: 'No encontramos esta prenda.',
    ningunoImportado: 'No se importó ninguna prenda',
  },
  general: {
    item: 'artículo',
    items: 'artículos',
    Item: 'Artículo',
    Items: 'Artículos',
    unItem: 'un artículo',
    tuPrimerItem: 'tu primer artículo',
    elItem: 'el artículo',
    agregarItem: 'Agregar artículo',
    agregaUnItem: 'Agrega un artículo',
    itemGuardado: '¡Artículo guardado!',
    itemDescartado: 'Artículo descartado',
    itemApartado: 'Artículo apartado',
    noEncontramosItems: 'No encontramos artículos',
    itemsDisponibles: 'Artículos disponibles',
    itemsVendidos: 'Artículos vendidos',
    costoPorItem: 'Costo por artículo',
    itemsDeEsteLote: 'Artículos de este lote',
    dineroParado: 'Dinero parado en mercancía',
    talla: 'Tamaño o medida',
    nuevoLote: 'Nuevo lote',
    ejemploLote: 'Ej. Lote mercado 50 totes',
    loteVacio: 'Registra un lote o compra para repartir el costo entre tus artículos.',
    ayudaLoteSinLotes: 'Si viene de un lote, créalo y el costo se reparte solo.',
    ayudaLoteConLotes: 'Elige el lote de donde salió, o escribe lo que te costó suelto.',
    ayudaLoteVacio: 'Toma la foto de cada artículo que venía en el lote. El costo se reparte solo entre ellos.',
    repartoLote: 'El costo se reparte solo entre los artículos que agregues a este lote.',
    sinVentas: 'Cuando marques un artículo como vendido, aparecerá aquí.',
    reconociendo: 'Reconociendo el artículo…',
    noEncontramosEste: 'No encontramos este artículo.',
    ningunoImportado: 'No se importó ningún artículo',
  },
} satisfies Record<ModoVocabulario, Record<string, string>>

export type Frases = (typeof FRASES)['ropa']

const CLAVE = 'bazaria-vocabulario'

interface VocabularioValor {
  modo: ModoVocabulario
  setModo: (m: ModoVocabulario) => void
  t: Frases
}

const Ctx = createContext<VocabularioValor | null>(null)

function leerModo(): ModoVocabulario {
  try {
    return localStorage.getItem(CLAVE) === 'general' ? 'general' : 'ropa'
  } catch {
    return 'ropa'
  }
}

export function VocabularioProvider({ children }: { children: ReactNode }) {
  const [modo, setModo] = useState<ModoVocabulario>(leerModo)

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, modo)
    } catch {
      // sin localStorage el modo dura solo esta sesión
    }
  }, [modo])

  return <Ctx.Provider value={{ modo, setModo, t: FRASES[modo] }}>{children}</Ctx.Provider>
}

/** Fuera del provider (p. ej. en pruebas) devuelve el vocabulario de ropa. */
export function useVocabulario(): VocabularioValor {
  return useContext(Ctx) ?? { modo: 'ropa', setModo: () => {}, t: FRASES.ropa }
}
