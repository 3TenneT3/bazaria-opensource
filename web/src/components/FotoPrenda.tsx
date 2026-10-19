import { useEffect, useState, type ImgHTMLAttributes } from 'react'
import { ImageOff } from 'lucide-react'
import type { Prenda } from '@/domain/types'
import { getFotoLocal } from '@/data'

interface FotoPrendaProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  prenda: Prenda
  /** Usa la miniatura si el backend la entrega (listas y cuadrículas). */
  mini?: boolean
}

/**
 * <img> inteligente para fotos de prendas.
 *
 * Las fotos del seed usan rutas estáticas (/demo/*.svg) y siempre funcionan.
 * Las fotos que sube la usuaria se guardan como Blob en IndexedDB, pero el
 * `fotoUrl` que queda en el registro es una URL `blob:` que solo vive durante
 * esa sesión del navegador — al recargar la página deja de servir nada.
 * Este componente detecta ese caso y vuelve a generar una URL fresca a partir
 * del Blob guardado en IndexedDB, liberándola al desmontar.
 */
// Datos demo ya guardados en IndexedDB apuntan a las ilustraciones .svg viejas; se sirven como .webp.
const urlFoto = (u: string) => u.replace(/^(\/demo\/prenda-.*)\.svg$/, '$1.webp')

export function FotoPrenda({ prenda: prendaCompleta, mini, className, ...props }: FotoPrendaProps) {
  const prenda = mini && prendaCompleta.fotoMiniUrl ? { ...prendaCompleta, fotoUrl: prendaCompleta.fotoMiniUrl } : prendaCompleta
  const [src, setSrc] = useState<string | null>(
    prenda.fotoUrl.startsWith('/') ? urlFoto(prenda.fotoUrl) : null,
  )
  const [error, setError] = useState(false)

  useEffect(() => {
    // Ruta estática del seed: siempre válida, no necesita resolución.
    // URL blob: se intenta usar tal cual primero (puede seguir viva en esta
    // misma sesión); si al cargar falla (onError), se regenera desde IndexedDB.
    setError(false)
    setSrc(urlFoto(prenda.fotoUrl))
  }, [prenda.fotoUrl, prenda.id])

  async function regenerarDesdeBlob() {
    const blob = await getFotoLocal(prenda.id)
    if (!blob) {
      setError(true)
      return
    }
    const url = URL.createObjectURL(blob)
    setSrc(url)
    setError(false)
  }

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-black/5 text-tinta/30 dark:bg-superficie-dark dark:text-tinta-dark/30 ${className ?? ''}`}
      >
        <ImageOff size={24} />
      </div>
    )
  }

  return (
    <img
      src={src ?? undefined}
      className={className}
      // CORS: así el service worker puede guardar la foto y se ve también sin conexión.
      crossOrigin="anonymous"
      onError={() => {
        if (prenda.fotoUrl.startsWith('/')) {
          setError(true)
        } else {
          regenerarDesdeBlob()
        }
      }}
      {...props}
    />
  )
}
