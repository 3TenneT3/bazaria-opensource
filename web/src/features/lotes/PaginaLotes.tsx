import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Package, Plus } from 'lucide-react'
import { getDataSource } from '@/data'
import type { Lote, ResumenLote } from '@/domain/types'
import { formatearMXN } from '@/lib/dinero'
import { Tarjeta } from '@/components/Tarjeta'
import { EstadoVacio } from '@/components/EstadoVacio'
import { Boton } from '@/components/Boton'
import { FormularioLote } from './FormularioLote'
import { useVocabulario } from '@/components/Vocabulario'

export function PaginaLotes() {
  const { t } = useVocabulario()
  const [lotes, setLotes] = useState<(Lote & { resumen: ResumenLote })[]>([])
  const [cargando, setCargando] = useState(true)
  const [formAbierto, setFormAbierto] = useState(false)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let activo = true
    async function cargar() {
      const ds = getDataSource()
      const lista = await ds.listarLotes()
      const conResumen = await Promise.all(
        lista.map(async (lote) => ({ ...lote, resumen: await ds.resumenLote(lote.id) })),
      )
      if (activo) {
        setLotes(conResumen)
        setCargando(false)
      }
    }
    cargar()
    return () => {
      activo = false
    }
  }, [recarga])

  if (cargando) {
    return <div className="py-10 text-center text-tinta/50">Cargando…</div>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Lotes</h1>
        <button
          onClick={() => setFormAbierto(true)}
          className="flex min-h-11 items-center gap-1 rounded-full bg-lila-500 px-4 text-sm font-semibold text-white"
        >
          <Plus size={18} /> Nuevo lote
        </button>
      </div>

      <FormularioLote
        abierto={formAbierto}
        onCerrar={() => setFormAbierto(false)}
        onCreado={() => {
          setFormAbierto(false)
          setRecarga((n) => n + 1)
        }}
      />

      {lotes.length === 0 ? (
        <EstadoVacio
          icono={<Package size={32} />}
          titulo="Aún no tienes lotes"
          descripcion={t.loteVacio}
        />
      ) : null}
      {lotes.length === 0 ? (
        <Boton onClick={() => setFormAbierto(true)}>Crear mi primer lote</Boton>
      ) : (
        <div className="flex flex-col gap-3">
          {lotes.map((lote) => {
            const porcentaje = Math.min(
              100,
              Math.round((lote.resumen.recuperado / lote.costoTotal) * 100),
            )
            return (
              <Link key={lote.id} to={`/app/lotes/${lote.id}`}>
                <Tarjeta className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-display font-bold">{lote.nombre}</p>
                    <p className="text-sm text-tinta/60 dark:text-tinta-dark/60">
                      {lote.piezasCompradas - lote.piezasDescartadas} piezas
                    </p>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                    <div
                      className="h-full rounded-full bg-menta-500"
                      style={{ width: `${porcentaje}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-tinta/60 dark:text-tinta-dark/60">
                    Recuperado {formatearMXN(lote.resumen.recuperado)} de {formatearMXN(lote.costoTotal)}
                  </p>
                </Tarjeta>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
