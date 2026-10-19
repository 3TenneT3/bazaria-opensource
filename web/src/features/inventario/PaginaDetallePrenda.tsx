import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Copy, Download } from 'lucide-react'
import { getDataSource } from '@/data'
import type { Prenda, CanalVenta } from '@/domain/types'
import { gananciaVenta } from '@/domain/costos'
import { formatearMXN } from '@/lib/dinero'
import { formatearFecha } from '@/lib/fechas'
import { Boton } from '@/components/Boton'
import { Tarjeta } from '@/components/Tarjeta'
import { BottomSheet } from '@/components/BottomSheet'
import { InputDinero } from '@/components/InputDinero'
import { useToast } from '@/components/Toast'
import { FotoPrenda } from '@/components/FotoPrenda'
import { useVocabulario } from '@/components/Vocabulario'
import { descargarFoto } from '@/lib/descargarFoto'
import { DuplicarPrenda } from './DuplicarPrenda'

const CANALES: { valor: CanalVenta; etiqueta: string }[] = [
  { valor: 'instagram', etiqueta: 'Instagram' },
  { valor: 'whatsapp', etiqueta: 'WhatsApp' },
  { valor: 'bazar', etiqueta: 'Bazar' },
  { valor: 'otro', etiqueta: 'Otro' },
]

export function PaginaDetallePrenda() {
  const { t } = useVocabulario()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { mostrarToast } = useToast()

  const [prenda, setPrenda] = useState<Prenda | null>(null)
  const [descargando, setDescargando] = useState(false)
  const [duplicarAbierto, setDuplicarAbierto] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [sheetVenta, setSheetVenta] = useState(false)
  const [precioFinal, setPrecioFinal] = useState(0)
  const [costoEnvio, setCostoEnvio] = useState(0)
  const [comision, setComision] = useState(0)
  const [canal, setCanal] = useState<CanalVenta>('instagram')
  const [gananciaConfirmada, setGananciaConfirmada] = useState<number | null>(null)
  const [ultimaVentaId, setUltimaVentaId] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let activo = true
    getDataSource()
      .obtenerPrenda(id)
      .then((p) => {
        if (!activo) return
        setPrenda(p)
        if (p) setPrecioFinal(p.precioVenta)
        setCargando(false)
      })
    return () => {
      activo = false
    }
  }, [id])

  async function cambiarStatus(status: Prenda['status']) {
    if (!prenda) return
    const actualizada = await getDataSource().cambiarStatus(prenda.id, status)
    setPrenda(actualizada)
    mostrarToast(status === 'descartada' ? t.itemDescartado : t.itemApartado)
  }

  async function confirmarVenta() {
    if (!prenda) return
    const venta = await getDataSource().registrarVenta(prenda.id, {
      precioFinal,
      costoEnvio,
      comision,
      canal,
    })
    const ganancia = gananciaVenta(precioFinal, prenda.costo, costoEnvio, comision)
    setGananciaConfirmada(ganancia)
    setUltimaVentaId(venta.id)
    setSheetVenta(false)
    const prendaActualizada = await getDataSource().obtenerPrenda(prenda.id)
    setPrenda(prendaActualizada)
  }

  async function deshacerVenta() {
    if (!ultimaVentaId) return
    await getDataSource().deshacerVenta(ultimaVentaId)
    setGananciaConfirmada(null)
    setUltimaVentaId(null)
    if (prenda) {
      const actualizada = await getDataSource().obtenerPrenda(prenda.id)
      setPrenda(actualizada)
    }
    mostrarToast('Venta deshecha')
  }

  if (cargando) {
    return <div className="py-10 text-center text-tinta/50">Cargando…</div>
  }

  if (!prenda) {
    return <div className="py-10 text-center text-tinta/50">{t.noEncontramosEste}</div>
  }

  if (gananciaConfirmada !== null) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="flex h-20 w-20 animate-bounce items-center justify-center rounded-full bg-menta-100 text-menta-500 dark:bg-menta-500/20">
          <Check size={40} strokeWidth={3} />
        </div>
        <p className="text-sm text-tinta/60 dark:text-tinta-dark/60">Lo que ganaste</p>
        <p className="font-display text-4xl font-bold text-menta-500">
          {formatearMXN(gananciaConfirmada)}
        </p>
        <button onClick={deshacerVenta} className="font-semibold text-lila-600 underline dark:text-lila-300">
          Deshacer
        </button>
        <Boton onClick={() => navigate('/app/inventario')} variante="secundario" className="mt-2">
          Volver al inventario
        </Boton>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => navigate(-1)} className="flex min-h-11 items-center gap-1 self-start pr-4 text-sm font-medium">
        <ArrowLeft size={18} /> Atrás
      </button>

      <div className="relative">
        <FotoPrenda
          prenda={prenda}
          alt={prenda.tipo ?? 'Prenda'}
          className="aspect-square w-full rounded-2xl object-cover"
        />
        <button
          onClick={async () => {
            setDescargando(true)
            try {
              const r = await descargarFoto(prenda)
              if (r === 'descargada') mostrarToast('Foto descargada')
            } catch {
              mostrarToast(
                navigator.onLine === false
                  ? 'Sin conexión: esta foto no está guardada en el teléfono.'
                  : 'No se pudo descargar la foto.',
              )
            } finally {
              setDescargando(false)
            }
          }}
          disabled={descargando}
          aria-label="Descargar foto"
          title="Descargar foto"
          className="absolute bottom-3 right-3 flex min-h-11 items-center gap-1.5 rounded-full bg-white/90 px-4 text-sm font-semibold text-tinta shadow-md backdrop-blur disabled:opacity-60 dark:bg-superficie-dark/90 dark:text-tinta-dark"
        >
          <Download size={16} />
          {descargando ? 'Preparando…' : 'Descargar'}
        </button>
      </div>

      <div>
        <h1 className="font-display text-xl font-bold capitalize">{prenda.tipo ?? 'Sin tipo'}</h1>
        <p className="text-sm text-tinta/60 dark:text-tinta-dark/60">
          {[prenda.color, prenda.talla, prenda.marca].filter(Boolean).join(' · ') || 'Sin más detalles'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Tarjeta className="p-3">
          <p className="text-xs text-tinta/60 dark:text-tinta-dark/60">Lo que te costó</p>
          <p className="font-display font-bold">{formatearMXN(prenda.costo)}</p>
        </Tarjeta>
        <Tarjeta className="p-3">
          <p className="text-xs text-tinta/60 dark:text-tinta-dark/60">En cuánto la das</p>
          <p className="font-display font-bold">{formatearMXN(prenda.precioVenta)}</p>
        </Tarjeta>
      </div>

      <p className="text-xs text-tinta/50 dark:text-tinta-dark/50">
        Agregada el {formatearFecha(prenda.creadoEn)} · Estado: {prenda.status}
      </p>

      <button
        onClick={() => setDuplicarAbierto(true)}
        className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-lila-500/50 px-4 text-sm font-semibold text-lila-700 dark:text-lila-300"
      >
        <Copy size={16} /> Duplicar (tengo más iguales)
      </button>
      <DuplicarPrenda
        prenda={prenda}
        abierto={duplicarAbierto}
        onCerrar={() => setDuplicarAbierto(false)}
        onDuplicadas={() => {
          setDuplicarAbierto(false)
          if (prenda.loteId) navigate(`/app/lotes/${prenda.loteId}`)
          else navigate('/app/inventario')
        }}
      />

      {prenda.status !== 'vendida' && prenda.status !== 'descartada' && (
        <div className="flex flex-col gap-2">
          <Boton
            onClick={() => {
              setPrecioFinal(prenda.precioVenta)
              setSheetVenta(true)
            }}
          >
            Marcar como vendida
          </Boton>
          <div className="grid grid-cols-2 gap-2">
            {prenda.status !== 'apartada' && (
              <Boton variante="secundario" onClick={() => cambiarStatus('apartada')}>
                Apartada
              </Boton>
            )}
            <Boton variante="peligro" onClick={() => cambiarStatus('descartada')}>
              Descartar
            </Boton>
          </div>
        </div>
      )}

      <BottomSheet abierto={sheetVenta} onCerrar={() => setSheetVenta(false)} titulo="Vendida">
        <div className="flex flex-col gap-4">
          <InputDinero label="Precio final" valorCentavos={precioFinal} onChange={setPrecioFinal} obligatorio />
          <InputDinero label="Envío" valorCentavos={costoEnvio} onChange={setCostoEnvio} />
          <InputDinero label="Comisión" valorCentavos={comision} onChange={setComision} />
          <div>
            <p className="mb-2 text-sm font-semibold">Canal</p>
            <div className="flex flex-wrap gap-2">
              {CANALES.map((c) => (
                <button
                  key={c.valor}
                  onClick={() => setCanal(c.valor)}
                  className={`min-h-11 rounded-full px-3 py-1.5 text-sm font-medium ${
                    canal === c.valor ? 'bg-lila-500 text-white' : 'bg-black/5 dark:bg-white/10'
                  }`}
                >
                  {c.etiqueta}
                </button>
              ))}
            </div>
          </div>
          <Boton onClick={confirmarVenta} className="w-full">
            Confirmar venta
          </Boton>
        </div>
      </BottomSheet>
    </div>
  )
}
