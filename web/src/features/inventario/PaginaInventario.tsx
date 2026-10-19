import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, SlidersHorizontal, Shirt, FileSpreadsheet, Download, Upload, FileDown } from 'lucide-react'
import { getDataSource } from '@/data'
import type { Prenda, StatusPrenda } from '@/domain/types'
import { formatearMXN } from '@/lib/dinero'
import { BottomSheet } from '@/components/BottomSheet'
import { Boton } from '@/components/Boton'
import { EstadoVacio } from '@/components/EstadoVacio'
import { FotoPrenda } from '@/components/FotoPrenda'
import { useToast } from '@/components/Toast'
import { descargarPlantilla, exportarInventario, leerInventario, fotoPlaceholder } from './importarExportar'
import { useVocabulario } from '@/components/Vocabulario'

const STATUS_OPCIONES: { valor: StatusPrenda | 'todas'; etiqueta: string }[] = [
  { valor: 'todas', etiqueta: 'Todas' },
  { valor: 'disponible', etiqueta: 'Disponible' },
  { valor: 'apartada', etiqueta: 'Apartada' },
  { valor: 'vendida', etiqueta: 'Vendida' },
  { valor: 'descartada', etiqueta: 'Descartada' },
]

const COLORES_CHIP: Record<StatusPrenda, string> = {
  // Opacas y con colores fijos: van encima de la foto, que puede ser de cualquier color.
  disponible: 'bg-[#d8f3e6] text-[#0f5a3c] dark:bg-[#0f3d2a] dark:text-[#bff0d8]',
  apartada: 'bg-[#fde2ec] text-[#8a1d4a] dark:bg-[#4a1229] dark:text-[#ffd0e2]',
  vendida: 'bg-[#e6e3f6] text-[#3b2f7a] dark:bg-[#2a2450] dark:text-[#ddd6ff]',
  descartada: 'bg-[#ececec] text-[#3a3a3a] dark:bg-[#333333] dark:text-[#e6e6e6]',
}

export function PaginaInventario() {
  const { t } = useVocabulario()
  const [prendas, setPrendas] = useState<Prenda[]>([])
  const [cargando, setCargando] = useState(true)
  const [texto, setTexto] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<StatusPrenda | 'todas'>('todas')
  const [filtroTipo, setFiltroTipo] = useState<string | null>(null)
  const [sheetAbierto, setSheetAbierto] = useState(false)
  const [datosAbierto, setDatosAbierto] = useState(false)
  const [importando, setImportando] = useState(false)
  const [erroresImport, setErroresImport] = useState<string[]>([])
  const { mostrarToast } = useToast()

  async function cargar() {
    setPrendas(await getDataSource().listarPrendas())
    setCargando(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  async function importar(archivo: File) {
    setImportando(true)
    setErroresImport([])
    try {
      const { prendas: nuevas, errores } = await leerInventario(archivo)
      const ds = getDataSource()
      for (const p of nuevas) await ds.crearPrenda(p, await fotoPlaceholder(p.tipo))
      setErroresImport(errores)
      await cargar()
      mostrarToast(
        nuevas.length
          ? `Se importaron ${nuevas.length} ${t.items}${errores.length ? ` (${errores.length} con error)` : ''}`
          : t.ningunoImportado,
      )
    } catch {
      mostrarToast('No pude leer el archivo. Usa la plantilla en .xlsx')
    } finally {
      setImportando(false)
    }
  }

  const tipos = useMemo(
    () => [...new Set(prendas.map((p) => p.tipo).filter((t): t is string => Boolean(t)))],
    [prendas],
  )

  const prendasFiltradas = useMemo(() => {
    return prendas.filter((p) => {
      if (filtroStatus !== 'todas' && p.status !== filtroStatus) return false
      if (filtroTipo && p.tipo !== filtroTipo) return false
      if (texto) {
        const t = texto.toLowerCase()
        const coincide = [p.tipo, p.color, p.marca, p.talla].some((campo) =>
          campo?.toLowerCase().includes(t),
        )
        if (!coincide) return false
      }
      return true
    })
  }, [prendas, filtroStatus, filtroTipo, texto])

  if (cargando) {
    return <div className="py-10 text-center text-tinta/50">Cargando…</div>
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="font-display text-2xl font-bold">Inventario</h1>
      </header>

      {prendasFiltradas.length === 0 ? (
        <EstadoVacio
          icono={<Shirt size={32} />}
          titulo={t.noEncontramosItems}
          descripcion={`Ajusta los filtros o agrega ${t.tuPrimerItem}.`}
          accion={
            <Link to="/app/nueva">
              <Boton>+ {t.agregarItem}</Boton>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {prendasFiltradas.map((prenda) => (
            <Link
              key={prenda.id}
              to={`/app/inventario/${prenda.id}`}
              className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-superficie-dark"
            >
              <div className="relative aspect-square bg-crema dark:bg-black/20">
                <FotoPrenda mini prenda={prenda} alt={prenda.tipo ?? 'Prenda'} className="h-full w-full object-cover" />
                <span
                  className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-bold capitalize shadow-sm ring-1 ring-black/10 ${COLORES_CHIP[prenda.status]}`}
                >
                  {prenda.status}
                </span>
              </div>
              <div className="p-2">
                <p className="truncate text-sm font-semibold capitalize">{prenda.tipo ?? 'Sin tipo'}</p>
                <p className="font-display text-sm font-bold text-lila-600 dark:text-lila-300">
                  {formatearMXN(prenda.precioVenta)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Barra al alcance del pulgar: búsqueda y acciones quedan abajo, encima de la navegación. */}
      <div className="sticky bottom-24 z-30 flex items-center gap-2 rounded-2xl border border-black/10 bg-white p-2 shadow-lg shadow-black/10 lg:bottom-4 dark:border-white/10 dark:bg-superficie-dark">
        <Search size={18} className="ml-2 shrink-0 text-tinta/60 dark:text-tinta-dark/60" />
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Busca tipo, color, marca…"
          className="min-h-12 min-w-0 flex-1 bg-transparent text-base outline-none"
        />
        <button
          onClick={() => setDatosAbierto(true)}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black/5 dark:bg-white/10"
          aria-label="Importar o exportar inventario"
        >
          <FileSpreadsheet size={20} />
        </button>
        <button
          onClick={() => setSheetAbierto(true)}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-lila-500 text-white"
          aria-label="Filtros"
        >
          <SlidersHorizontal size={20} />
        </button>
      </div>

      <BottomSheet abierto={datosAbierto} onCerrar={() => setDatosAbierto(false)} titulo="Importar / exportar">
        <div className="flex flex-col gap-3">
          <Boton variante="secundario" onClick={descargarPlantilla} className="flex items-center justify-center gap-2">
            <FileDown size={18} /> Descargar plantilla
          </Boton>
          <Boton
            variante="secundario"
            onClick={() => exportarInventario(prendas)}
            disabled={prendas.length === 0}
            className="flex items-center justify-center gap-2"
          >
            <Download size={18} /> Exportar inventario ({prendas.length})
          </Boton>
          <label
            className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-lila-500 px-5 py-3 font-semibold text-white ${importando ? 'opacity-50' : ''}`}
          >
            <Upload size={18} /> {importando ? 'Importando…' : 'Importar desde Excel'}
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              disabled={importando}
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) importar(f)
              }}
            />
          </label>
          <p className="text-xs text-tinta/60 dark:text-tinta-dark/60">
            Descarga la plantilla, llénala ({t.unItem} por renglón) e impórtala. Los {t.items} entran como
            disponibles con una foto de relleno; puedes cambiarla después.
          </p>
          {erroresImport.length > 0 && (
            <ul className="max-h-32 overflow-y-auto rounded-xl bg-rosa-100 p-3 text-xs text-tinta">
              {erroresImport.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      </BottomSheet>

      <BottomSheet abierto={sheetAbierto} onCerrar={() => setSheetAbierto(false)} titulo="Filtros">
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-sm font-semibold">Estado</p>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPCIONES.map((op) => (
                <button
                  key={op.valor}
                  onClick={() => setFiltroStatus(op.valor)}
                  className={`min-h-11 rounded-full px-3 py-1.5 text-sm font-medium ${
                    filtroStatus === op.valor
                      ? 'bg-lila-500 text-white'
                      : 'bg-black/5 dark:bg-white/10'
                  }`}
                >
                  {op.etiqueta}
                </button>
              ))}
            </div>
          </div>
          {tipos.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold">Tipo</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFiltroTipo(null)}
                  className={`min-h-11 rounded-full px-3 py-1.5 text-sm font-medium capitalize ${
                    filtroTipo === null ? 'bg-lila-500 text-white' : 'bg-black/5 dark:bg-white/10'
                  }`}
                >
                  Todos
                </button>
                {tipos.map((tipo) => (
                  <button
                    key={tipo}
                    onClick={() => setFiltroTipo(tipo)}
                    className={`min-h-11 rounded-full px-3 py-1.5 text-sm font-medium capitalize ${
                      filtroTipo === tipo ? 'bg-lila-500 text-white' : 'bg-black/5 dark:bg-white/10'
                    }`}
                  >
                    {tipo}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Boton onClick={() => setSheetAbierto(false)} className="w-full">
            Ver resultados
          </Boton>
        </div>
      </BottomSheet>
    </div>
  )
}
