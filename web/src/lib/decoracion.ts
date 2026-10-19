import type { SkinId } from '@/components/TemaProvider'

// Stickers por skin: 4 esquinas (sup-izq, sup-der, inf-izq, inf-der) + mascota (y su nombre, si tiene).
// Una esquina puede ser [claro, oscuro] si el sticker cambia con el modo.
// Las skins sin ilustraciones propias muestran las pantallas limpias.
export const DECORACION: Partial<Record<SkinId, { esquinas: (string | [string, string])[]; mascota: string; nombre?: string }>> = {
  doodle: {
    esquinas: ['/doodle/flor.webp', '/doodle/carita1.webp', '/doodle/nota.webp', '/doodle/pinceles.webp'],
    mascota: '/doodle/mascota.webp',
  },
  y2k: {
    esquinas: [['/y2k/angel-wings.webp', '/y2k/angel-wings-oscuro.webp'], '/y2k/smiley-barbed.webp', ['/y2k/star-spiral-claro.svg', '/y2k/star-spiral.svg'], ['/y2k/badge-bazar2000.webp', '/y2k/badge-bazar2000-oscuro.webp']],
    mascota: '/y2k/star-liquid.webp',
  },
  gyaru: {
    esquinas: ['/gyaru/star-trail.svg', '/gyaru/heart-checker.svg', '/gyaru/star-glitter.svg', '/gyaru/flip-phone-kawaii-halo.webp'],
    mascota: '/gyaru/mascota-halo.webp',
  },
  goth: {
    esquinas: ['/goth/velas-halo.webp', '/goth/murcielago-halo.webp', '/goth/rosa-halo.webp', '/goth/ataud-halo.webp'],
    mascota: '/goth/mascota-halo.webp',
  },
  tokyo: {
    esquinas: ['/tokyo/badge-tokyo.webp', '/tokyo/reloj.webp', '/tokyo/bolsa.webp', '/tokyo/tenis.webp'],
    mascota: '/tokyo/mascota.webp',
    nombre: 'Ponz',
  },
  fairy: {
    esquinas: ['/fairy/hada.webp', '/fairy/mariposa.webp', '/fairy/caracol-casa.webp', '/fairy/fresa.webp'],
    mascota: '/fairy/mascota.webp',
  },
}

export const POSICIONES = [
  'left-[6%] top-[8%] h-16 w-16 -rotate-12 sm:h-24 sm:w-24',
  'right-[8%] top-[14%] h-14 w-14 rotate-12 sm:h-20 sm:w-20',
  'bottom-[10%] left-[8%] h-16 w-16 rotate-6 sm:h-24 sm:w-24',
  'bottom-[8%] right-[7%] h-16 w-16 sm:h-24 sm:w-24',
]
