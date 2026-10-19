import { useEffect, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { getDataSource } from '@/data'
import type { Prenda } from '@/domain/types'
import { Boton } from '@/components/Boton'
import { BottomSheet } from '@/components/BottomSheet'
import { useToast } from '@/components/Toast'
import { useVocabulario } from '@/components/Vocabulario'
import { obtenerBlobFoto } from '@/lib/descargarFoto'

const MAX_COPIAS = 50

interface Props {
  prenda: Prenda
  abierto: boolean
  onCerrar: () => void
  onDuplicadas: (n: number) => void
}

/**
 * Crea N copias de una prenda con los mismos datos y la misma foto.
 * Cada copia es independiente (se vende por separado) y entra como disponible.
 * Si es de un lote, el costo se vuelve a repartir solo entre todas.
 */
export function DuplicarPrenda({ prenda, abierto, onCerrar, onDuplicadas }: Props) {
  const { t } = useVocabulario()
  const { mostrarToast } = useToast()
  const [cantidad, setCantidad] = useState(1)
  const [faltan, setFaltan] = useState<number | null>(null)
  const [progreso, setProgreso] = useState<number | null>(null)

  // En un lote, sugerir las piezas que faltan por capturar (ej. lote de 5 con 1 capturada -> 4).
  useEffect(() => {
    if (!abierto || !prenda.loteId) return
    let activo = true
    const ds = getDataSource()
    Promise.all([ds.listarLotes(), ds.listarPrendas({ loteId: prenda.loteId })]).then(([lotes, prendas]) => {
      if (!activo) return
      const lote = lotes.find((l) => l.id === prenda.loteId)
      if (!lote) return
      const n = lote.piezasCompradas - lote.piezasDescartadas - prendas.filter((p) => p.status !== 'descartada').length
      setFaltan(n > 0 ? n : 0)
      if (n > 0) setCantidad(Math.min(n, MAX_COPIAS))
    })
    return () => {
      activo = false
    }
  }, [abierto, prenda.loteId])

  const cambiar = (d: number) => setCantidad((c) => Math.min(MAX_COPIAS, Math.max(1, c + d)))

  async function duplicar() {
    setProgreso(0)
    let hechas = 0
    try {
      const foto = await obtenerBlobFoto(prenda)
      const ds = getDataSource()
      for (let i = 0; i < cantidad; i++) {
        await ds.crearPrenda(
          {
            loteId: prenda.loteId,
            tipo: prenda.tipo,
            color: prenda.color,
            talla: prenda.talla,
            marca: prenda.marca,
            estado: prenda.estado,
            // En un lote el costo lo reparte el lote; suelta, se copia el costo escrito.
            costo: prenda.loteId ? 0 : prenda.costo,
            costoManual: prenda.loteId ? false : prenda.costoManual,
            precioVenta: prenda.precioVenta,
          },
          foto,
        )
        hechas++
        setProgreso(hechas)
      }
      mostrarToast(hechas === 1 ? 'Se creó 1 copia' : `Se crearon ${hechas} copias`)
      onDuplicadas(hechas)
    } catch {
      mostrarToast(
        hechas > 0
          ? `Se crearon ${hechas} de ${cantidad}. Intenta de nuevo con las que faltan.`
          : navigator.onLine === false
            ? 'Sin conexión y la foto no está en este teléfono. Conéctate e inténtalo de nuevo.'
            : 'No se pudo duplicar. Intenta de nuevo.',
      )
      if (hechas > 0) onDuplicadas(hechas)
    } finally {
      setProgreso(null)
    }
  }

  const ocupado = progreso !== null

  return (
    <BottomSheet abierto={abierto} onCerrar={ocupado ? () => {} : onCerrar} titulo="Duplicar">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-tinta/70 dark:text-tinta-dark/70">
          Crea copias con la misma foto, datos y precio. Cada una se vende por separado.
          {prenda.loteId && ' El costo del lote se vuelve a repartir entre todas.'}
        </p>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => cambiar(-1)}
            disabled={ocupado || cantidad <= 1}
            aria-label="Menos"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-black/5 disabled:opacity-40 dark:bg-white/10"
          >
            <Minus size={20} />
          </button>
          <div className="min-w-24 text-center">
            <p className="font-display text-4xl font-bold">{cantidad}</p>
            <p className="text-xs text-tinta/60 dark:text-tinta-dark/60">{cantidad === 1 ? 'copia' : 'copias'}</p>
          </div>
          <button
            onClick={() => cambiar(1)}
            disabled={ocupado || cantidad >= MAX_COPIAS}
            aria-label="Más"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-black/5 disabled:opacity-40 dark:bg-white/10"
          >
            <Plus size={20} />
          </button>
        </div>

        {faltan !== null && (
          <p className="text-center text-xs text-tinta/60 dark:text-tinta-dark/60">
            {faltan > 0
              ? `Faltan ${faltan} por capturar en este lote.`
              : `Este lote ya tiene todas sus piezas; si agregas más, el costo por ${t.item} baja.`}
          </p>
        )}

        <Boton onClick={duplicar} disabled={ocupado}>
          {ocupado ? `Creando ${progreso} de ${cantidad}…` : `Crear ${cantidad} ${cantidad === 1 ? 'copia' : 'copias'}`}
        </Boton>
      </div>
    </BottomSheet>
  )
}
