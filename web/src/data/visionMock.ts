import type { AnalisisVision, EstadoPrenda } from '@/domain/types'

const RESULTADOS_PLAUSIBLES: Omit<AnalisisVision, 'confianza'>[] = [
  { tipo: 'blusa', color: 'lila', talla: 'M', marca: null, estado: 'seminueva' },
  { tipo: 'pantalon', color: 'azul', talla: 'S', marca: 'Zara', estado: 'usada' },
  { tipo: 'vestido', color: 'rosa', talla: 'M', marca: null, estado: 'nueva' },
  { tipo: 'falda', color: 'menta', talla: 'L', marca: null, estado: 'usada' },
  { tipo: 'chamarra', color: 'mostaza', talla: 'M', marca: 'Levi\'s', estado: 'seminueva' },
  { tipo: 'blusa', color: 'crema', talla: 'S', marca: null, estado: 'nueva' },
  { tipo: 'pantalon', color: 'lila', talla: 'L', marca: null, estado: 'usada' },
]

/**
 * Simula el análisis de IA de visión de una foto de prenda.
 * Tarda ~1.2s y 1 de cada 8 veces devuelve null (flujo de captura manual).
 */
export async function analizarFotoMock(): Promise<AnalisisVision | null> {
  await new Promise((resolve) => setTimeout(resolve, 1200))

  if (Math.random() < 1 / 8) {
    return null
  }

  const base = RESULTADOS_PLAUSIBLES[Math.floor(Math.random() * RESULTADOS_PLAUSIBLES.length)]
  const confianza = 0.7 + Math.random() * 0.28

  return { ...base, confianza: Math.round(confianza * 100) / 100 }
}

export const ESTADOS_PRENDA: EstadoPrenda[] = ['nueva', 'seminueva', 'usada']
