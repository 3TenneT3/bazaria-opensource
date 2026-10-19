import type { Prenda } from './types'

/** Las prendas descartadas se quedan en la papelera este tiempo y luego se borran solas. */
export const DIAS_EN_PAPELERA = 30

const DIA_MS = 24 * 60 * 60 * 1000

/** Días que le quedan en la papelera (0 = se borra hoy). null si no está en la papelera o no tiene fecha. */
export function diasRestantes(prenda: Pick<Prenda, 'status' | 'descartadaEn'>, ahora = Date.now()): number | null {
  if (prenda.status !== 'descartada' || !prenda.descartadaEn) return null
  const vence = new Date(prenda.descartadaEn).getTime() + DIAS_EN_PAPELERA * DIA_MS
  return Math.max(0, Math.ceil((vence - ahora) / DIA_MS))
}

export function venceYa(prenda: Pick<Prenda, 'status' | 'descartadaEn'>, ahora = Date.now()): boolean {
  if (prenda.status !== 'descartada' || !prenda.descartadaEn) return false
  return ahora >= new Date(prenda.descartadaEn).getTime() + DIAS_EN_PAPELERA * DIA_MS
}
