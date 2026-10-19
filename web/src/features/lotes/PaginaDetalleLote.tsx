import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import { getDataSource } from '@/data'
import type { Lote, Prenda, ResumenLote } from '@/domain/types'
import { formatearMXN } from '@/lib/dinero'
import { formatearFecha } from '@/lib/fechas'
import { Tarjeta } from '@/components/Tarjeta'
import { FotoPrenda } from '@/components/FotoPrenda'
import { useVocabulario } from '@/components/Vocabulario'

export function PaginaDetalleLote() {
  const { t } = useVocabulario()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [lote, setLote] = useState<Lote | null>(null)
  const [resumen, setResumen] = useState<ResumenLote | null>(null)
  const [prendas, setPrendas] = useState<Prenda[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!id) return
    let activo = true
    async function cargar() {
      const ds = getDataSource()
      const [lotes, resumenLote, todasLasPrendas] = await Promise.all([
        ds.listarLotes(),
        ds.resumenLote(id!),
        ds.listarPrendas({ loteId: id }),
      ])
      if (!activo) return
      setLote(lotes.find((l) => l.id === id) ?? null)
      setResumen(resumenLote)
      setPrendas(todasLasPrendas)
      setCargando(false)
    }
    cargar()
    return () => {
      activo = false
    }
  }, [id])

  if (cargando || !lote || !resumen) {
    return <div className="py-10 text-center text-tinta/50">Cargando…</div>
  }

  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm font-medium">
        <ArrowLeft size={18} /> Atrás
      </button>

      <h1 className="font-display text-xl font-bold">{lote.nombre}</h1>
      <p className="text-sm text-tinta/60 dark:text-tinta-dark/60">
        Comprado el {formatearFecha(lote.fechaCompra)}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Tarjeta className="p-3">
          <p className="text-xs text-tinta/60 dark:text-tinta-dark/60">Costo total</p>
          <p className="font-display font-bold">{formatearMXN(lote.costoTotal)}</p>
        </Tarjeta>
        <Tarjeta className="p-3">
          <p className="text-xs text-tinta/60 dark:text-tinta-dark/60">{t.costoPorItem}</p>
          <p className="font-display font-bold">{formatearMXN(resumen.costoUnitarioActual)}</p>
        </Tarjeta>
        <Tarjeta className="p-3">
          <p className="text-xs text-tinta/60 dark:text-tinta-dark/60">Recuperado</p>
          <p className="font-display font-bold text-menta-500">{formatearMXN(resumen.recuperado)}</p>
        </Tarjeta>
        <Tarjeta className="p-3">
          <p className="text-xs text-tinta/60 dark:text-tinta-dark/60">Falta por recuperar</p>
          <p className="font-display font-bold">{formatearMXN(resumen.faltante)}</p>
        </Tarjeta>
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="font-display text-base font-bold">
            {t.itemsDeEsteLote}{' '}
            <span className="font-normal text-tinta/60 dark:text-tinta-dark/60">
              ({prendas.length} de {lote.piezasCompradas - lote.piezasDescartadas})
            </span>
          </h2>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Link
            to={`/app/nueva?lote=${lote.id}`}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-lila-500/50 text-center text-xs font-semibold text-lila-600 dark:text-lila-300"
          >
            <Plus size={24} />
            {t.agregarItem}
          </Link>
          {prendas.map((prenda) => (
            <Link
              key={prenda.id}
              to={`/app/inventario/${prenda.id}`}
              className="overflow-hidden rounded-xl bg-white dark:bg-superficie-dark"
            >
              <FotoPrenda prenda={prenda} alt={prenda.tipo ?? 'Prenda'} className="aspect-square w-full object-cover" />
              <p className="p-1 text-center text-[10px] font-semibold">{formatearMXN(prenda.costo)}</p>
            </Link>
          ))}
        </div>
        {prendas.length === 0 && (
          <p className="mt-3 text-sm text-tinta/60 dark:text-tinta-dark/60">
            {t.ayudaLoteVacio}
          </p>
        )}
      </section>
    </div>
  )
}
