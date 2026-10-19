import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, SlidersHorizontal, Shirt, FileSpreadsheet, Download, Upload, FileDown, ListChecks, Check, Trash2, Undo2, ImageMinus } from 'lucide-react'
import { esModoDemo, getDataSource } from '@/data'
import { mb } from '@/lib/bytes'
import type { Prenda, StatusPrenda } from '@/domain/types'
import { formatearMXN } from '@/lib/dinero'
import { DIAS_EN_PAPELERA, diasRestantes } from '@/domain/papelera'
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
]
// La papelera NO es un filtro más: tiene su propio botón (barra de abajo y Ajustes) y lo descartado
// nunca aparece en «Todas». Se abre con /app/inventario?vista=papelera.

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
  const [params, setParams] = useSearchParams()
  const vistaPapelera = params.get('vista') === 'papelera'
  const [filtroStatusInventario, setFiltroStatus] = useState<StatusPrenda | 'todas'>('todas')
  // En la papelera solo se ve lo descartado; fuera de ella, nunca.
  const filtroStatus: StatusPrenda | 'todas' = vistaPapelera ? 'descartada' : filtroStatusInventario
  function abrirPapelera(abrir: boolean) {
    const siguiente = new URLSearchParams(params)
    if (abrir) siguiente.set('vista', 'papelera')
    else siguiente.delete('vista')
    setParams(siguiente)
  }
  const [filtroTipo, setFiltroTipo] = useState<string | null>(null)
  const [sheetAbierto, setSheetAbierto] = useState(false)
  const [datosAbierto, setDatosAbierto] = useState(false)
  const [importando, setImportando] = useState(false)
  const [erroresImport, setErroresImport] = useState<string[]>([])
  const [seleccionando, setSeleccionando] = useState(false)
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)
  const [confirmarReducir, setConfirmarReducir] = useState(false)
  const [trabajando, setTrabajando] = useState(false)
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

  const totalPapelera = useMemo(() => prendas.filter((p) => p.status === 'descartada').length, [prendas])

  const prendasFiltradas = useMemo(() => {
    return prendas.filter((p) => {
      if (filtroStatus === 'todas' ? p.status === 'descartada' : p.status !== filtroStatus) return false
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

  // Una vendida solo se puede elegir para quitarle la foto grande, y eso necesita la cuenta (es del servidor).
  const seleccionable = (p: Prenda) => p.status !== 'vendida' || (!esModoDemo && !p.fotoReducida)
  const elegidas = prendas.filter((p) => seleccion.has(p.id))
  const aDescartar = elegidas.filter((p) => p.status === 'disponible' || p.status === 'apartada')
  const enPapelera = elegidas.filter((p) => p.status === 'descartada')
  const aReducir = elegidas.filter((p) => p.status === 'vendida')

  function salirDeSeleccion() {
    setSeleccionando(false)
    setSeleccion(new Set())
    setConfirmarBorrar(false)
    setConfirmarReducir(false)
  }

  function alternar(id: string) {
    setSeleccion((previa) => {
      const nueva = new Set(previa)
      if (nueva.has(id)) nueva.delete(id)
      else nueva.add(id)
      return nueva
    })
  }

  function seleccionarTodas() {
    const visibles = prendasFiltradas.filter(seleccionable)
    const todasMarcadas = visibles.length > 0 && visibles.every((p) => seleccion.has(p.id))
    setSeleccion(todasMarcadas ? new Set() : new Set(visibles.map((p) => p.id)))
  }

  // Una por una y en orden: cada cambio recalcula el reparto de costo de su paca.
  async function aplicarEnLote(lista: Prenda[], accion: (id: string) => Promise<unknown>, mensaje: string) {
    setTrabajando(true)
    try {
      for (const p of lista) await accion(p.id)
      mostrarToast(`${lista.length} ${mensaje}`)
    } catch {
      mostrarToast('No se pudo terminar. Revisa tu inventario e intenta de nuevo.')
    } finally {
      await cargar()
      setTrabajando(false)
      salirDeSeleccion()
    }
  }

  async function reducirElegidas() {
    setTrabajando(true)
    try {
      const r = await getDataSource().liberarFotos(aReducir.map((p) => p.id))
      mostrarToast(
        r.liberados > 0
          ? `Liberaste ${mb(r.bytesLiberados)} (${r.liberados} ${r.liberados === 1 ? 'foto' : 'fotos'})`
          : 'No se quitó ninguna: esa foto la usa otra prenda que no está vendida.',
      )
    } catch {
      mostrarToast('No se pudo. Revisa tu conexión e intenta de nuevo.')
    } finally {
      await cargar()
      setTrabajando(false)
      salirDeSeleccion()
    }
  }

  const descartarElegidas = () =>
    aplicarEnLote(aDescartar, (id) => getDataSource().cambiarStatus(id, 'descartada'), `${t.items} a la papelera`)
  const restaurarElegidas = () =>
    aplicarEnLote(enPapelera, (id) => getDataSource().cambiarStatus(id, 'disponible'), `${t.items} restauradas`)
  const borrarElegidas = () =>
    aplicarEnLote(enPapelera, (id) => getDataSource().eliminarPrenda(id), `${t.items} borradas para siempre`)

  if (cargando) {
    return <div className="py-10 text-center text-tinta/50">Cargando…</div>
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">
          {seleccionando ? `${seleccion.size} elegidas` : filtroStatus === 'descartada' ? 'Papelera' : 'Inventario'}
        </h1>
        {seleccionando ? (
          <div className="flex gap-2">
            <button onClick={seleccionarTodas} className="min-h-11 rounded-full bg-black/5 px-4 text-sm font-semibold dark:bg-white/10">
              Todas
            </button>
            <button onClick={salirDeSeleccion} className="min-h-11 rounded-full bg-black/5 px-4 text-sm font-semibold dark:bg-white/10">
              Cancelar
            </button>
          </div>
        ) : (
          prendasFiltradas.length > 0 && (
            <button
              onClick={() => setSeleccionando(true)}
              className="flex min-h-11 items-center gap-2 rounded-full bg-black/5 px-4 text-sm font-semibold dark:bg-white/10"
            >
              <ListChecks size={18} /> Seleccionar
            </button>
          )
        )}
      </header>
      {vistaPapelera && (
        <button
          onClick={() => abrirPapelera(false)}
          className="-mt-2 self-start text-sm font-semibold underline"
        >
          ← Volver al inventario
        </button>
      )}
      {vistaPapelera && (
        <p className="-mt-2 text-sm text-tinta/70 dark:text-tinta-dark/70">
          Lo que descartas se queda aquí {DIAS_EN_PAPELERA} días y luego se borra solo, con su foto. Mientras tanto
          puedes restaurarlo o borrarlo antes.
        </p>
      )}

      {prendasFiltradas.length === 0 && vistaPapelera ? (
        <EstadoVacio
          icono={<Trash2 size={32} />}
          titulo="La papelera está vacía"
          descripcion={`Lo que mandes a la papelera aparece aquí ${DIAS_EN_PAPELERA} días antes de borrarse solo.`}
          accion={<Boton onClick={() => abrirPapelera(false)}>Volver al inventario</Boton>}
        />
      ) : prendasFiltradas.length === 0 ? (
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
          {prendasFiltradas.map((prenda) => {
            const dias = diasRestantes(prenda)
            const marcada = seleccion.has(prenda.id)
            const contenido = (
              <>
                <div className="relative aspect-square bg-crema dark:bg-black/20">
                  <FotoPrenda mini prenda={prenda} alt={prenda.tipo ?? 'Prenda'} className="h-full w-full object-cover" />
                  <span
                    className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-bold capitalize shadow-sm ring-1 ring-black/10 ${COLORES_CHIP[prenda.status]}`}
                  >
                    {prenda.status}
                  </span>
                  {seleccionando && seleccionable(prenda) && (
                    <span
                      aria-hidden="true"
                      className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 ${
                        marcada ? 'border-lila-600 bg-lila-600 text-white' : 'border-white bg-black/30 text-transparent'
                      }`}
                    >
                      <Check size={16} strokeWidth={3} />
                    </span>
                  )}
                </div>
                <div className="p-2 text-left">
                  <p className="truncate text-sm font-semibold capitalize">{prenda.tipo ?? 'Sin tipo'}</p>
                  <p className="font-display text-sm font-bold text-lila-600 dark:text-lila-300">
                    {formatearMXN(prenda.precioVenta)}
                  </p>
                  {dias !== null && (
                    <p className="text-xs text-tinta/70 dark:text-tinta-dark/70">
                      {dias === 0 ? 'Se borra hoy' : `Se borra en ${dias} ${dias === 1 ? 'día' : 'días'}`}
                    </p>
                  )}
                </div>
              </>
            )
            const clase = 'block overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-superficie-dark'
            return seleccionando ? (
              <button
                key={prenda.id}
                type="button"
                disabled={!seleccionable(prenda)}
                aria-pressed={marcada}
                onClick={() => alternar(prenda.id)}
                className={`${clase} w-full ${marcada ? 'ring-4 ring-lila-600' : ''} ${seleccionable(prenda) ? '' : 'opacity-50'}`}
              >
                {contenido}
              </button>
            ) : (
              <Link key={prenda.id} to={`/app/inventario/${prenda.id}`} className={clase}>
                {contenido}
              </Link>
            )
          })}
        </div>
      )}

      {/* Barra al alcance del pulgar: búsqueda y acciones quedan abajo, encima de la navegación. */}
      {seleccionando ? (
        <div className="sticky bottom-24 z-30 flex flex-wrap items-center gap-2 rounded-2xl border border-black/10 bg-white p-2 shadow-lg shadow-black/10 lg:bottom-4 dark:border-white/10 dark:bg-superficie-dark">
          {elegidas.length === 0 && (
            <p className="px-2 py-3 text-sm text-tinta/70 dark:text-tinta-dark/70">Toca las prendas que quieras mover, borrar o aligerar.</p>
          )}
          {aReducir.length > 0 && (
            <Boton variante="secundario" disabled={trabajando} onClick={() => setConfirmarReducir(true)} className="flex flex-1 items-center justify-center gap-2">
              <ImageMinus size={18} /> Quitar foto grande ({aReducir.length})
            </Boton>
          )}
          {aDescartar.length > 0 && (
            <Boton variante="peligro" disabled={trabajando} onClick={descartarElegidas} className="flex flex-1 items-center justify-center gap-2">
              <Trash2 size={18} /> A la papelera ({aDescartar.length})
            </Boton>
          )}
          {enPapelera.length > 0 && (
            <>
              <Boton variante="secundario" disabled={trabajando} onClick={restaurarElegidas} className="flex flex-1 items-center justify-center gap-2">
                <Undo2 size={18} /> Restaurar ({enPapelera.length})
              </Boton>
              <Boton variante="peligro" disabled={trabajando} onClick={() => setConfirmarBorrar(true)} className="flex flex-1 items-center justify-center gap-2">
                <Trash2 size={18} /> Borrar para siempre ({enPapelera.length})
              </Boton>
            </>
          )}
        </div>
      ) : (
      <div className="sticky bottom-24 z-30 flex items-center gap-2 rounded-2xl border border-black/10 bg-white p-2 shadow-lg shadow-black/10 lg:bottom-4 dark:border-white/10 dark:bg-superficie-dark">
        <Search size={18} className="ml-2 shrink-0 text-tinta/60 dark:text-tinta-dark/60" />
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Busca tipo, color, marca…"
          className="min-h-12 min-w-0 flex-1 bg-transparent text-base outline-none"
        />
        <button
          onClick={() => {
            salirDeSeleccion()
            abrirPapelera(!vistaPapelera)
          }}
          className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
            vistaPapelera ? 'bg-tinta text-white dark:bg-tinta-dark dark:text-superficie-dark' : 'bg-black/5 dark:bg-white/10'
          }`}
          aria-label={vistaPapelera ? 'Salir de la papelera' : `Papelera (${totalPapelera})`}
          aria-pressed={vistaPapelera}
          title={vistaPapelera ? 'Volver al inventario' : 'Papelera'}
        >
          <Trash2 size={20} />
          {totalPapelera > 0 && !vistaPapelera && (
            <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-[11px] font-bold leading-5 text-white">
              {totalPapelera}
            </span>
          )}
        </button>
        <button
          onClick={() => setDatosAbierto(true)}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black/5 dark:bg-white/10"
          aria-label="Importar o exportar inventario"
        >
          <FileSpreadsheet size={20} />
        </button>
        <button
          onClick={() => setSheetAbierto(true)}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-lila-600 text-white"
          aria-label="Filtros"
        >
          <SlidersHorizontal size={20} />
        </button>
      </div>
      )}

      <BottomSheet abierto={confirmarReducir} onCerrar={() => setConfirmarReducir(false)} titulo="¿Quitar la foto grande?">
        <div className="flex flex-col gap-4">
          <p className="text-sm">
            De {aReducir.length} {aReducir.length === 1 ? 'venta' : 'ventas'} se queda la miniatura y todos los datos
            (precio, ganancia, fecha). La foto grande no se recupera: si deshaces la venta o la duplicas, la prenda
            tendrá la foto chica.
          </p>
          <Boton disabled={trabajando} onClick={reducirElegidas} className="w-full">
            Sí, quitar ({aReducir.length})
          </Boton>
          <Boton variante="secundario" onClick={() => setConfirmarReducir(false)} className="w-full">
            Mejor no
          </Boton>
        </div>
      </BottomSheet>

      <BottomSheet abierto={confirmarBorrar} onCerrar={() => setConfirmarBorrar(false)} titulo="¿Borrar para siempre?">
        <div className="flex flex-col gap-4">
          <p className="text-sm">
            Se borrarán {enPapelera.length} {t.items} y sus fotos. Esto no se puede deshacer, pero libera espacio.
          </p>
          <Boton variante="peligro" disabled={trabajando} onClick={borrarElegidas} className="w-full">
            Sí, borrar ({enPapelera.length})
          </Boton>
          <Boton variante="secundario" onClick={() => setConfirmarBorrar(false)} className="w-full">
            Mejor no
          </Boton>
        </div>
      </BottomSheet>

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
            className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-lila-600 px-5 py-3 font-semibold text-white ${importando ? 'opacity-50' : ''}`}
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
                  onClick={() => {
                    abrirPapelera(false)
                    setFiltroStatus(op.valor)
                  }}
                  className={`min-h-11 rounded-full px-3 py-1.5 text-sm font-medium ${
                    !vistaPapelera && filtroStatus === op.valor
                      ? 'bg-lila-600 text-white'
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
                    filtroTipo === null ? 'bg-lila-600 text-white' : 'bg-black/5 dark:bg-white/10'
                  }`}
                >
                  Todos
                </button>
                {tipos.map((tipo) => (
                  <button
                    key={tipo}
                    onClick={() => setFiltroTipo(tipo)}
                    className={`min-h-11 rounded-full px-3 py-1.5 text-sm font-medium capitalize ${
                      filtroTipo === tipo ? 'bg-lila-600 text-white' : 'bg-black/5 dark:bg-white/10'
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
