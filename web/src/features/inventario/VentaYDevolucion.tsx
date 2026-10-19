import { useEffect, useState } from 'react'
import { Undo2 } from 'lucide-react'
import { getDataSource } from '@/data'
import type { DestinoDevolucion, Prenda, Venta } from '@/domain/types'
import { gananciaDeVenta } from '@/domain/costos'
import { formatearMXN } from '@/lib/dinero'
import { formatearFecha } from '@/lib/fechas'
import { Boton } from '@/components/Boton'
import { Tarjeta } from '@/components/Tarjeta'
import { BottomSheet } from '@/components/BottomSheet'
import { InputDinero } from '@/components/InputDinero'
import { useToast } from '@/components/Toast'

const DESTINOS: { valor: DestinoDevolucion; titulo: string; detalle: string }[] = [
  { valor: 'disponible', titulo: 'Vuelve al inventario', detalle: 'Te la regresó en buen estado: la puedes vender otra vez.' },
  { valor: 'descartada', titulo: 'Llegó dañada', detalle: 'Va a la papelera. Su costo cuenta como pérdida.' },
  { valor: 'cliente', titulo: 'Se la quedó la clienta', detalle: 'Le regresaste una parte del dinero (descuento por algún detalle).' },
]

const TEXTO_DESTINO: Record<DestinoDevolucion, string> = {
  disponible: 'la prenda volvió al inventario',
  descartada: 'la prenda llegó dañada y fue a la papelera',
  cliente: 'la clienta se quedó la prenda',
}

/** Venta vigente de una prenda vendida + botón para registrar una devolución total o parcial. */
export function VentaYDevolucion({ prenda, onCambio }: { prenda: Prenda; onCambio: (p: Prenda | null) => void }) {
  const { mostrarToast } = useToast()
  const [venta, setVenta] = useState<Venta | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [reembolso, setReembolso] = useState(0)
  const [destino, setDestino] = useState<DestinoDevolucion>('disponible')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    let activo = true
    getDataSource()
      .listarVentas()
      .then((ventas) => {
        if (!activo) return
        // listarVentas viene de la más reciente a la más vieja: la primera de esta prenda es la vigente.
        setVenta(ventas.find((v) => v.prendaId === prenda.id) ?? null)
      })
    return () => {
      activo = false
    }
  }, [prenda.id, prenda.status])

  if (!venta || prenda.status !== 'vendida') return null

  const devuelta = Boolean(venta.devueltaEn)
  const vistaPrevia = gananciaDeVenta({ ...venta, reembolso, destinoDevolucion: destino }, prenda.costo)
  const reembolsoInvalido = reembolso < 0 || reembolso > venta.precioFinal

  async function confirmar() {
    if (!venta || reembolsoInvalido) return
    setGuardando(true)
    try {
      const devuelta = await getDataSource().registrarDevolucion(venta.id, { reembolso, destino })
      // Si la clienta se la quedó, la prenda sigue «vendida» y no cambia: se actualiza la venta aquí.
      setVenta(devuelta)
      setAbierto(false)
      mostrarToast(destino === 'disponible' ? 'Devolución registrada: la prenda volvió al inventario' : 'Devolución registrada')
      onCambio(await getDataSource().obtenerPrenda(prenda.id))
    } catch (e) {
      mostrarToast(e instanceof Error ? e.message : 'No se pudo registrar la devolución.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <Tarjeta className="flex flex-col gap-1 p-3">
        <p className="text-xs text-tinta/60 dark:text-tinta-dark/60">Venta</p>
        <p className="text-sm">
          Vendida el {formatearFecha(venta.fechaVenta)} en <b>{formatearMXN(venta.precioFinal)}</b>
        </p>
        {devuelta && (
          <p className="text-sm">
            Devolución del {formatearFecha(venta.devueltaEn as string)}: reembolsaste{' '}
            <b>{formatearMXN(venta.reembolso ?? 0)}</b>; {TEXTO_DESTINO[venta.destinoDevolucion ?? 'cliente']}.
          </p>
        )}
        <p className="text-sm">
          Ganancia: <b>{formatearMXN(gananciaDeVenta(venta, prenda.costo))}</b>
        </p>
      </Tarjeta>

      {!devuelta && (
        <Boton
          variante="secundario"
          onClick={() => {
            setReembolso(venta.precioFinal)
            setDestino('disponible')
            setAbierto(true)
          }}
          className="flex items-center justify-center gap-2"
        >
          <Undo2 size={18} /> Registrar devolución
        </Boton>
      )}

      <BottomSheet abierto={abierto} onCerrar={() => setAbierto(false)} titulo="Devolución">
        <div className="flex flex-col gap-4">
          <InputDinero label="¿Cuánto le regresaste?" valorCentavos={reembolso} onChange={setReembolso} obligatorio />
          <p className="-mt-2 text-xs text-tinta/60 dark:text-tinta-dark/60">
            Cobraste {formatearMXN(venta.precioFinal)}. Si le regresaste solo una parte, escribe esa cantidad.
          </p>
          {reembolso > venta.precioFinal && (
            <p className="-mt-2 text-xs font-semibold text-red-600">No puede ser más de lo que cobraste.</p>
          )}
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="¿Qué pasa con la prenda?">
            <p className="text-sm font-semibold">¿Qué pasa con la prenda?</p>
            {DESTINOS.map((d) => (
              <button
                key={d.valor}
                role="radio"
                aria-checked={destino === d.valor}
                onClick={() => setDestino(d.valor)}
                className={`rounded-2xl border-2 p-3 text-left ${
                  destino === d.valor ? 'border-lila-600 bg-lila-600/10' : 'border-black/10 dark:border-white/10'
                }`}
              >
                <p className="text-sm font-semibold">{d.titulo}</p>
                <p className="text-xs text-tinta/70 dark:text-tinta-dark/70">{d.detalle}</p>
              </button>
            ))}
          </div>
          <p className="text-sm">
            Así queda tu ganancia en esta venta:{' '}
            <b className={vistaPrevia < 0 ? 'text-perdida' : 'text-menta-500'}>{formatearMXN(vistaPrevia)}</b>
            <span className="block text-xs text-tinta/60 dark:text-tinta-dark/60">
              El envío y la comisión que ya pagaste siguen contando como gasto.
            </span>
          </p>
          <Boton onClick={confirmar} disabled={guardando || reembolsoInvalido} className="w-full">
            Registrar devolución
          </Boton>
          <Boton variante="secundario" onClick={() => setAbierto(false)} className="w-full">
            Cancelar
          </Boton>
        </div>
      </BottomSheet>
    </>
  )
}
