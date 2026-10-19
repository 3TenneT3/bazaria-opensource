import { useState } from 'react'
import { getDataSource } from '@/data'
import type { Lote } from '@/domain/types'
import { Boton } from '@/components/Boton'
import { BottomSheet } from '@/components/BottomSheet'
import { InputDinero } from '@/components/InputDinero'
import { useToast } from '@/components/Toast'
import { useVocabulario } from '@/components/Vocabulario'

interface FormularioLoteProps {
  abierto: boolean
  onCerrar: () => void
  /** Se llama con el lote ya creado (p. ej. para seleccionarlo en el alta de prenda). */
  onCreado: (lote: Lote) => void
}

function hoyISO(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

const claseInput =
  'min-h-11 w-full rounded-2xl border border-black/10 bg-white px-4 py-2 text-sm dark:border-white/10 dark:bg-superficie-dark'

/** Alta rápida de un lote o paca: nombre, lo que costó todo y cuántas piezas trae. */
export function FormularioLote({ abierto, onCerrar, onCreado }: FormularioLoteProps) {
  const { t } = useVocabulario()
  const { mostrarToast } = useToast()
  const [nombre, setNombre] = useState('')
  const [costoTotal, setCostoTotal] = useState(0)
  const [piezas, setPiezas] = useState('')
  const [fecha, setFecha] = useState(hoyISO)
  const [guardando, setGuardando] = useState(false)

  const piezasNum = Number.parseInt(piezas, 10)
  const valido = nombre.trim().length > 0 && costoTotal > 0 && piezasNum > 0

  function limpiar() {
    setNombre('')
    setCostoTotal(0)
    setPiezas('')
    setFecha(hoyISO())
  }

  async function guardar() {
    if (!valido || guardando) return
    setGuardando(true)
    try {
      const lote = await getDataSource().crearLote({
        nombre: nombre.trim(),
        costoTotal,
        piezasCompradas: piezasNum,
        piezasDescartadas: 0,
        // Mediodía local: evita que la fecha "salte" un día al pasar a UTC.
        fechaCompra: new Date(`${fecha}T12:00:00`).toISOString(),
        notas: null,
      })
      mostrarToast('Lote creado')
      limpiar()
      onCreado(lote)
    } catch {
      mostrarToast('No se pudo crear el lote. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <BottomSheet abierto={abierto} onCerrar={onCerrar} titulo={t.nuevoLote}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          <span>Nombre</span>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={t.ejemploLote}
            className={claseInput}
            autoFocus
          />
        </label>

        <InputDinero label="Lo que pagaste por todo" valorCentavos={costoTotal} onChange={setCostoTotal} obligatorio />

        <label className="flex flex-col gap-1 text-sm font-medium">
          <span>¿Cuántas piezas trae?</span>
          <input
            value={piezas}
            onChange={(e) => setPiezas(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            placeholder="Ej. 100"
            className={claseInput}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          <span>Fecha de compra</span>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={claseInput} />
        </label>

        {valido && (
          <p className="text-sm text-tinta/70 dark:text-tinta-dark/70">
            Cada pieza te sale en{' '}
            <strong>
              {(costoTotal / 100 / piezasNum).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
            </strong>
            . {t.repartoLote}
          </p>
        )}

        <Boton onClick={guardar} disabled={!valido || guardando}>
          {guardando ? 'Guardando…' : 'Crear lote'}
        </Boton>
      </div>
    </BottomSheet>
  )
}
