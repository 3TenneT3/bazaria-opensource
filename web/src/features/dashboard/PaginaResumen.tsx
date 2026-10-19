import { useEffect, useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { getDataSource } from '@/data'
import type { ResumenMes, Prenda, Venta } from '@/domain/types'
import { formatearMXN } from '@/lib/dinero'
import { nombreMes } from '@/lib/fechas'
import { Tarjeta } from '@/components/Tarjeta'
import { Boton } from '@/components/Boton'
import { EstadoVacio } from '@/components/EstadoVacio'
import { FotoPrenda } from '@/components/FotoPrenda'
import { exportarExcel } from '@/features/exportar/exportarExcel'
import { useVocabulario } from '@/components/Vocabulario'

export function PaginaResumen() {
  const { t } = useVocabulario()
  const ahora = new Date()
  const [anio, setAnio] = useState(ahora.getFullYear())
  const [mes, setMes] = useState(ahora.getMonth() + 1)
  const [resumen, setResumen] = useState<ResumenMes | null>(null)
  const [prendas, setPrendas] = useState<Prenda[]>([])
  const [ventas, setVentas] = useState<Venta[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true)
      const ds = getDataSource()
      const [r, p, v] = await Promise.all([
        ds.resumenMes(anio, mes),
        ds.listarPrendas(),
        ds.listarVentas(),
      ])
      if (!activo) return
      setResumen(r)
      setPrendas(p)
      setVentas(v)
      setCargando(false)
    }
    cargar()
    return () => {
      activo = false
    }
  }, [anio, mes])

  function cambiarMes(delta: number) {
    let nuevoMes = mes + delta
    let nuevoAnio = anio
    if (nuevoMes > 12) {
      nuevoMes = 1
      nuevoAnio++
    } else if (nuevoMes < 1) {
      nuevoMes = 12
      nuevoAnio--
    }
    setMes(nuevoMes)
    setAnio(nuevoAnio)
  }

  if (cargando || !resumen) {
    return <div className="py-10 text-center text-tinta/50">Cargando…</div>
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold">Resumen</h1>

      <div className="flex items-center justify-between rounded-2xl bg-white p-2 dark:bg-superficie-dark">
        <button onClick={() => cambiarMes(-1)} className="min-h-11 min-w-11 rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
          ‹
        </button>
        <p className="font-display font-bold capitalize">
          {nombreMes(mes)} {anio}
        </p>
        <button onClick={() => cambiarMes(1)} className="min-h-11 min-w-11 rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
          ›
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Tarjeta className="p-4">
          <p className="text-xs text-tinta/60 dark:text-tinta-dark/60">Vendiste</p>
          <p className="font-display text-xl font-bold">{formatearMXN(resumen.totalVentas)}</p>
        </Tarjeta>
        <Tarjeta className="p-4">
          <p className="text-xs text-tinta/60 dark:text-tinta-dark/60">Ganaste de verdad</p>
          <p className={`font-display text-xl font-bold ${resumen.gananciaNeta < 0 ? 'text-perdida' : 'text-menta-500'}`}>
            {formatearMXN(resumen.gananciaNeta)}
          </p>
        </Tarjeta>
        <Tarjeta className="col-span-2 p-4 md:col-span-1">
          <p className="text-xs text-tinta/60 dark:text-tinta-dark/60">{t.itemsVendidos}</p>
          <p className="font-display text-xl font-bold">{resumen.numeroPrendasVendidas}</p>
        </Tarjeta>
      </div>

      {resumen.numeroPrendasVendidas > 0 && (
        <Tarjeta className="p-4">
          <h2 className="mb-3 font-display text-base font-bold">De dónde sale tu ganancia</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt>Vendiste</dt>
              <dd className="font-semibold">{formatearMXN(resumen.totalVentas)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>
                Lo que te costó la mercancía
                <span className="block text-xs text-tinta/60 dark:text-tinta-dark/60">
                  {t.itemsVendidos.toLowerCase()} este mes
                </span>
              </dt>
              <dd className="font-semibold">−{formatearMXN(resumen.costoMercancia)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Envíos</dt>
              <dd className="font-semibold">−{formatearMXN(resumen.envios)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Comisiones</dt>
              <dd className="font-semibold">−{formatearMXN(resumen.comisiones)}</dd>
            </div>
            <div className="flex justify-between border-t border-black/10 pt-2 text-base dark:border-white/10">
              <dt className="font-bold">Ganaste de verdad</dt>
              <dd className={`font-display font-bold ${resumen.gananciaNeta < 0 ? 'text-perdida' : 'text-menta-500'}`}>
                {formatearMXN(resumen.gananciaNeta)}
              </dd>
            </div>
          </dl>
        </Tarjeta>
      )}

      {resumen.topTipos.length > 0 && (
        <section>
          <h2 className="mb-2 font-display text-base font-bold">Lo que más te dejó</h2>
          <div className="flex flex-col gap-2">
            {resumen.topTipos.map((t, i) => (
              <Tarjeta key={t.tipo} className="flex items-center justify-between p-3">
                <p className="text-sm font-semibold capitalize">
                  {i + 1}. {t.tipo}
                </p>
                <p className="font-display font-bold text-lila-600 dark:text-lila-300">
                  {formatearMXN(t.ganancia)}
                </p>
              </Tarjeta>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-display text-base font-bold">Llevan más de 30 días sin venderse</h2>
        {resumen.prendasEstancadas.length === 0 ? (
          <EstadoVacio titulo="¡Nada estancado!" descripcion="Todo tu inventario se mueve bien." />
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {resumen.prendasEstancadas.map((p) => (
              <div key={p.id} className="overflow-hidden rounded-xl bg-white dark:bg-superficie-dark">
                <FotoPrenda prenda={p} alt={p.tipo ?? 'Prenda'} className="aspect-square w-full object-cover" />
              </div>
            ))}
          </div>
        )}
      </section>

      <Boton onClick={() => exportarExcel(prendas, ventas)} className="flex items-center justify-center gap-2">
        <FileSpreadsheet size={18} />
        Exportar Excel
      </Boton>
    </div>
  )
}
