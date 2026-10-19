import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Tema = 'claro' | 'oscuro'
const CLAVE_STORAGE = 'bazar_tema'
const CLAVE_SKIN = 'bazar_skin'

export const SKINS = [
  // Colores: solo cambian la paleta. Estéticas: paleta + ilustraciones y stickers propios.
  { id: 'lila', nombre: 'Lila', color: '#9b7fd1', grupo: 'color' },
  { id: 'menta', nombre: 'Menta', color: '#3a9c76', grupo: 'color' },
  { id: 'rosa', nombre: 'Rosa', color: '#d9558f', grupo: 'color' },
  { id: 'oceano', nombre: 'Océano', color: '#3f7fc9', grupo: 'color' },
  { id: 'atardecer', nombre: 'Atardecer', color: '#d9672a', grupo: 'color' },
  { id: 'doodle', nombre: 'Doodle', color: '#4a47c4', grupo: 'estetica', vista: '/doodle/mascota.webp' },
  { id: 'y2k', nombre: 'Y2K', color: '#3d5a86', grupo: 'estetica', vista: '/y2k/star-liquid.webp' },
  { id: 'gyaru', nombre: 'Gyaru', color: '#d6147a', grupo: 'estetica', vista: '/gyaru/mascota-halo.webp' },
  { id: 'goth', nombre: 'Goth', color: '#2f6fd6', grupo: 'estetica', vista: '/goth/mascota-halo.webp' },
  { id: 'tokyo', nombre: 'Tokyo 2000', color: '#c0262d', grupo: 'estetica', vista: '/tokyo/mascota.webp' },
  { id: 'fairy', nombre: 'Fairy', color: '#b5402f', grupo: 'estetica', vista: '/fairy/mascota.webp' },
] as const
export type SkinId = (typeof SKINS)[number]['id']

function skinGuardada(): SkinId {
  try {
    const v = localStorage.getItem(CLAVE_SKIN)
    return SKINS.some((s) => s.id === v) ? (v as SkinId) : 'doodle'
  } catch {
    return 'doodle'
  }
}

interface TemaContextValor {
  tema: Tema
  alternarTema: () => void
  skin: SkinId
  setSkin: (s: SkinId) => void
}

const TemaContext = createContext<TemaContextValor | null>(null)

function temaGuardado(): Tema | null {
  try {
    const valor = localStorage.getItem(CLAVE_STORAGE)
    return valor === 'claro' || valor === 'oscuro' ? valor : null
  } catch {
    return null
  }
}

function temaDelSistema(): Tema {
  if (typeof window === 'undefined' || !window.matchMedia) return 'claro'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro'
}

function aplicarClaseDocumento(tema: Tema) {
  document.documentElement.classList.toggle('dark', tema === 'oscuro')
}

export function TemaProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(() => temaGuardado() ?? temaDelSistema())
  const [skin, setSkin] = useState<SkinId>(skinGuardada)

  useEffect(() => {
    document.documentElement.dataset.skin = skin
    try {
      localStorage.setItem(CLAVE_SKIN, skin)
    } catch {
      // sin localStorage la skin dura solo esta sesión
    }
  }, [skin])

  useEffect(() => {
    aplicarClaseDocumento(tema)
    try {
      localStorage.setItem(CLAVE_STORAGE, tema)
    } catch {
      // localStorage no disponible (modo privado); el tema solo dura esta sesión.
    }
  }, [tema])

  function alternarTema() {
    setTema((actual) => (actual === 'claro' ? 'oscuro' : 'claro'))
  }

  return <TemaContext.Provider value={{ tema, alternarTema, skin, setSkin }}>{children}</TemaContext.Provider>
}

export function useTema(): TemaContextValor {
  const ctx = useContext(TemaContext)
  if (!ctx) throw new Error('useTema debe usarse dentro de TemaProvider')
  return ctx
}
