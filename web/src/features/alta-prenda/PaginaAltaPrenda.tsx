import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Camera, Check, ImagePlus } from 'lucide-react'
import { getDataSource, iaDisponible } from '@/data'
import type { Lote, EstadoPrenda, AnalisisVision } from '@/domain/types'
import { comprimirImagen } from '@/lib/imagen'
import { pesosACentavos, centavosAPesosInput } from '@/lib/dinero'
import { Boton } from '@/components/Boton'
import { InputDinero } from '@/components/InputDinero'
import { useToast } from '@/components/Toast'
import { FormularioLote } from '@/features/lotes/FormularioLote'
import { useVocabulario } from '@/components/Vocabulario'

const CREAR_LOTE = '__crear_lote__'

const ESTADOS: EstadoPrenda[] = ['nueva', 'seminueva', 'usada']

type Paso = 'captura' | 'analizando' | 'formulario' | 'listo'

export function PaginaAltaPrenda() {
  const { t } = useVocabulario()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { mostrarToast } = useToast()
  const camaraRef = useRef<HTMLInputElement>(null)
  const galeriaRef = useRef<HTMLInputElement>(null)

  const [paso, setPaso] = useState<Paso>('captura')
  const [fotoComprimida, setFotoComprimida] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [lotes, setLotes] = useState<Lote[]>([])

  const [tipo, setTipo] = useState('')
  const [color, setColor] = useState('')
  const [talla, setTalla] = useState('')
  const [marca, setMarca] = useState('')
  const [estado, setEstado] = useState<EstadoPrenda>('seminueva')
  // ?lote=<id>: viene desde el detalle de un lote, ya queda elegido.
  const [loteId, setLoteId] = useState<string | null>(() => params.get('lote'))
  const [costoManual, setCostoManual] = useState(0)
  const [precioVenta, setPrecioVenta] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const [formLote, setFormLote] = useState(false)

  useEffect(() => {
    getDataSource()
      .listarLotes()
      .then(setLotes)
  }, [])

  async function manejarArchivo(archivo: File | undefined) {
    if (!archivo) return
    const comprimida = await comprimirImagen(archivo)
    setFotoComprimida(comprimida)
    setPreviewUrl(URL.createObjectURL(comprimida))
    if (!(await iaDisponible())) {
      setPaso('formulario')
      return
    }
    setPaso('analizando')

    const analisis: AnalisisVision | null = await getDataSource().analizarFoto(comprimida)
    if (analisis) {
      setTipo(analisis.tipo ?? '')
      setColor(analisis.color ?? '')
      setTalla(analisis.talla ?? '')
      setMarca(analisis.marca ?? '')
      setEstado(analisis.estado ?? 'seminueva')
    } else {
      mostrarToast('No pudimos reconocer la prenda. Captúrala a mano.')
    }
    setPaso('formulario')
  }

  function reiniciarFormulario() {
    setFotoComprimida(null)
    setPreviewUrl(null)
    setTipo('')
    setColor('')
    setTalla('')
    setMarca('')
    setEstado('seminueva')
    // "Agregar otra" dentro de un lote sigue en el mismo lote: así se captura la paca de corrido.
    setLoteId(params.get('lote'))
    setCostoManual(0)
    setPrecioVenta(0)
    setPaso('captura')
  }

  async function guardar() {
    if (!fotoComprimida) return
    setGuardando(true)
    try {
      await getDataSource().crearPrenda(
        {
          loteId,
          tipo: tipo || null,
          color: color || null,
          talla: talla || null,
          marca: marca || null,
          estado,
          costo: loteId ? 0 : costoManual,
          costoManual: !loteId,
          precioVenta,
        },
        fotoComprimida,
      )
      setPaso('listo')
    } catch {
      mostrarToast(
        navigator.onLine === false
          ? 'Sin conexión: no se pudo guardar la prenda. Conéctate e inténtalo de nuevo.'
          : 'No se pudo guardar la prenda. Intenta de nuevo.',
      )
    } finally {
      setGuardando(false)
    }
  }

  if (paso === 'listo') {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-menta-100 text-menta-500 dark:bg-menta-500/20">
          <Check size={40} strokeWidth={3} />
        </div>
        <p className="font-display text-xl font-bold">{t.itemGuardado}</p>
        <Boton onClick={reiniciarFormulario}>
          {loteId ? `Agregar otra a ${lotes.find((l) => l.id === loteId)?.nombre ?? 'este lote'}` : 'Agregar otra'}
        </Boton>
        {loteId ? (
          <Boton variante="secundario" onClick={() => navigate(`/app/lotes/${loteId}`)}>
            Ver el lote
          </Boton>
        ) : (
          <Boton variante="secundario" onClick={() => navigate('/app/inventario')}>
            Ver inventario
          </Boton>
        )}
      </div>
    )
  }

  if (paso === 'captura') {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <h1 className="font-display text-xl font-bold">{t.agregaUnItem}</h1>
        <p className="max-w-xs text-sm text-tinta/60 dark:text-tinta-dark/60">
          Toma una foto con la cámara o sube una que ya tengas en tu galería.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={() => camaraRef.current?.click()}
            className="flex h-40 w-40 flex-col items-center justify-center gap-2 rounded-2xl bg-lila-50 text-lila-600 dark:bg-lila-700/20 dark:text-lila-100"
          >
            <Camera size={40} />
            <span className="text-sm font-semibold">Tomar foto</span>
          </button>
          <button
            onClick={() => galeriaRef.current?.click()}
            className="flex h-40 w-40 flex-col items-center justify-center gap-2 rounded-2xl bg-lila-50 text-lila-600 dark:bg-lila-700/20 dark:text-lila-100"
          >
            <ImagePlus size={40} />
            <span className="text-sm font-semibold">Subir de galería</span>
          </button>
        </div>
        {/* Cámara: capture abre la cámara trasera directo. Galería: sin capture, abre el selector de archivos. */}
        <input
          ref={camaraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            manejarArchivo(e.target.files?.[0])
            e.target.value = '' // permite elegir la misma foto otra vez
          }}
        />
        <input
          ref={galeriaRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            manejarArchivo(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {previewUrl && (
        <img src={previewUrl} alt="Vista previa" className="aspect-square w-full rounded-2xl object-cover" />
      )}

      {paso === 'analizando' ? (
        <div className="flex flex-col gap-3">
          <p className="text-center text-sm text-tinta/60 dark:text-tinta-dark/60">
            {t.reconociendo}
          </p>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-11 animate-pulse rounded-2xl bg-black/5 dark:bg-white/10" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Tipo" valor={tipo} onChange={setTipo} />
            <Campo label="Color" valor={color} onChange={setColor} />
            <Campo label={t.talla} valor={talla} onChange={setTalla} />
            <Campo label="Marca" valor={marca} onChange={setMarca} />
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">Estado</p>
            <div className="flex gap-2">
              {ESTADOS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEstado(e)}
                  className={`min-h-11 flex-1 rounded-full px-3 py-1.5 text-sm font-medium capitalize ${
                    estado === e ? 'bg-lila-600 text-white' : 'bg-black/5 dark:bg-white/10'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">Lote o costo</p>
            <select
              value={loteId ?? ''}
              onChange={(e) => {
                if (e.target.value === CREAR_LOTE) {
                  setFormLote(true)
                  return
                }
                setLoteId(e.target.value || null)
              }}
              className="min-h-11 w-full rounded-2xl border border-black/10 bg-white px-4 py-2 text-sm dark:border-white/10 dark:bg-superficie-dark"
            >
              <option value="">Escribir costo manual</option>
              {lotes.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre}
                </option>
              ))}
              <option value={CREAR_LOTE}>+ Crear lote nuevo…</option>
            </select>
            <p className="mt-1 text-xs text-tinta/60 dark:text-tinta-dark/60">
              {lotes.length === 0
                ? t.ayudaLoteSinLotes
                : t.ayudaLoteConLotes}
            </p>
            <FormularioLote
              abierto={formLote}
              onCerrar={() => setFormLote(false)}
              onCreado={(lote) => {
                setLotes((ls) => [...ls, lote])
                setLoteId(lote.id)
                setFormLote(false)
              }}
            />
          </div>

          {!loteId && (
            <InputDinero label="Lo que te costó" valorCentavos={costoManual} onChange={setCostoManual} />
          )}

          <InputDinero
            label="En cuánto la das"
            valorCentavos={precioVenta}
            onChange={setPrecioVenta}
            obligatorio
          />

          <Boton onClick={guardar} disabled={guardando || !precioVenta}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Boton>
        </>
      )}
    </div>
  )
}

function Campo({
  label,
  valor,
  onChange,
}: {
  label: string
  valor: string
  onChange: (v: string) => void
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      <span>{label}</span>
      <input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-lila-500 dark:border-white/10 dark:bg-superficie-dark"
      />
    </label>
  )
}

// Reexport util usado en inputs de dinero crudo si se requiere en otra parte.
export { pesosACentavos, centavosAPesosInput }
