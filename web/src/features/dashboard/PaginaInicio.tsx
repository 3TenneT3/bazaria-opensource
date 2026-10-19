import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDataSource } from '@/data'
import type { Prenda, Venta } from '@/domain/types'
import { capitalParado, gananciaVenta } from '@/domain/costos'
import { formatearMXN } from '@/lib/dinero'
import { formatearFecha, nombreMes } from '@/lib/fechas'
import { Tarjeta } from '@/components/Tarjeta'
import { EstadoVacio } from '@/components/EstadoVacio'
import { FotoPrenda } from '@/components/FotoPrenda'
import { Shirt } from 'lucide-react'
import { useTema } from '@/components/TemaProvider'
import { DECORACION } from '@/lib/decoracion'
import { useVocabulario } from '@/components/Vocabulario'

export function PaginaInicio() {
  const { t } = useVocabulario()
  const deco = DECORACION[useTema().skin]
  const mascota = deco?.mascota
  const [cargando, setCargando] = useState(true)
  const [gananciaMes, setGananciaMes] = useState(0)
  const [capital, setCapital] = useState(0)
  const [disponibles, setDisponibles] = useState(0)
  const [ultimasVentas, setUltimasVentas] = useState<{ venta: Venta; prenda: Prenda | null }[]>([])

  useEffect(() => {
    let activo = true
    async function cargar() {
      const ds = getDataSource()
      const ahora = new Date()
      const [resumen, prendas, ventas] = await Promise.all([
        ds.resumenMes(ahora.getFullYear(), ahora.getMonth() + 1),
        ds.listarPrendas(),
        ds.listarVentas(),
      ])
      if (!activo) return

      setGananciaMes(resumen.gananciaNeta)
      setCapital(capitalParado(prendas))
      setDisponibles(prendas.filter((p) => p.status === 'disponible').length)

      const prendaPorId = new Map(prendas.map((p) => [p.id, p]))
      setUltimasVentas(
        ventas.slice(0, 5).map((venta) => ({ venta, prenda: prendaPorId.get(venta.prendaId) ?? null })),
      )
      setCargando(false)
    }
    cargar()
    return () => {
      activo = false
    }
  }, [])

  if (cargando) {
    return <div className="py-10 text-center text-tinta/50">Cargando…</div>
  }

  const ahora = new Date()

  return (
    <div className="flex flex-col gap-4">
      <header className="relative">
        {mascota && <img src={mascota} alt={deco?.nombre ?? ''} title={deco?.nombre} className="mascota-inicio" />}
        <h1 className="font-display text-2xl font-bold">Hola 👋</h1>
        <p className="text-sm text-tinta/60 dark:text-tinta-dark/60">
          Resumen de {nombreMes(ahora.getMonth() + 1)}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Tarjeta className="p-4">
          <p className="text-xs text-tinta/60 dark:text-tinta-dark/60">Lo que ganaste este mes</p>
          <p className="mt-1 font-display text-xl font-bold text-lila-600 dark:text-lila-300">
            {formatearMXN(gananciaMes)}
          </p>
        </Tarjeta>
        <Tarjeta className="p-4">
          <p className="text-xs text-tinta/60 dark:text-tinta-dark/60">{t.dineroParado}</p>
          <p className="mt-1 font-display text-xl font-bold">{formatearMXN(capital)}</p>
        </Tarjeta>
        <Tarjeta className="col-span-2 p-4 md:col-span-1">
          <p className="text-xs text-tinta/60 dark:text-tinta-dark/60">{t.itemsDisponibles}</p>
          <p className="mt-1 font-display text-xl font-bold">{disponibles}</p>
        </Tarjeta>
      </div>

      <section>
        <h2 className="mb-2 font-display text-base font-bold">Últimas ventas</h2>
        {ultimasVentas.length === 0 ? (
          <EstadoVacio
            icono={<Shirt size={32} />}
            titulo="Aún no hay ventas"
            descripcion={t.sinVentas}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {ultimasVentas.map(({ venta, prenda }) => (
              <Tarjeta key={venta.id} className="flex items-center gap-3 p-3">
                {prenda && (
                  <FotoPrenda
                    prenda={prenda}
                    alt={prenda.tipo ?? 'Prenda'}
                    className="h-12 w-12 rounded-xl object-cover"
                  />
                )}
                <div className="flex-1">
                  <p className="text-sm font-semibold">{prenda?.tipo ?? 'Prenda'}</p>
                  <p className="text-xs text-tinta/50 dark:text-tinta-dark/50">
                    {formatearFecha(venta.fechaVenta)}
                  </p>
                </div>
                {prenda ? (
                  <div className="text-right">
                    <p className="font-display text-sm font-bold text-menta-500">
                      +{formatearMXN(gananciaVenta(venta.precioFinal, prenda.costo, venta.costoEnvio, venta.comision))}
                    </p>
                    <p className="text-xs text-tinta/70 dark:text-tinta-dark/70">vendida en {formatearMXN(venta.precioFinal)}</p>
                  </div>
                ) : (
                  <p className="text-sm text-tinta/70 dark:text-tinta-dark/70">vendida en {formatearMXN(venta.precioFinal)}</p>
                )}
              </Tarjeta>
            ))}
          </div>
        )}
      </section>

      <Link
        to="/app/nueva"
        className="rounded-2xl bg-lila-500 p-4 text-center font-display font-bold text-white"
      >
        + {t.agregarItem}
      </Link>
    </div>
  )
}
