import type { Lote, Prenda, Venta, EstadoPrenda, StatusPrenda, CanalVenta } from '@/domain/types'
import { prorratearLote } from '@/domain/costos'

function idAleatorio(): string {
  return crypto.randomUUID()
}

function fechaHaceDias(dias: number): string {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() - dias)
  return fecha.toISOString()
}

const TIPOS_DEMO = ['blusa', 'pantalon', 'vestido', 'falda', 'chamarra']
const COLORES_DEMO = ['lila', 'menta', 'rosa', 'crema', 'azul', 'mostaza']
const TALLAS_DEMO = ['XS', 'S', 'M', 'L', 'XL']
const ESTADOS_DEMO: EstadoPrenda[] = ['nueva', 'seminueva', 'usada']
const CANALES_DEMO: CanalVenta[] = ['instagram', 'whatsapp', 'bazar', 'otro']

/**
 * Los 25 fotos del seed (/public/demo) se nombran prenda-01-blusa.webp,
 * prenda-02-pantalon.webp, ... ciclando TIPOS_DEMO cada 5. El tipo SIEMPRE
 * se deriva del número de foto para que fotoUrl apunte a un archivo que
 * realmente existe (antes `tipo` y `numeroFoto` se calculaban con fórmulas
 * independientes y podían desincronizarse, generando URLs rotas).
 */
function fotoParaNumero(numeroFoto: number): { tipo: string; fotoUrl: string } {
  const tipo = TIPOS_DEMO[(numeroFoto - 1) % TIPOS_DEMO.length]
  return { tipo, fotoUrl: `/demo/prenda-${String(numeroFoto).padStart(2, '0')}-${tipo}.webp` }
}

export interface SemillaDatos {
  lotes: Lote[]
  prendas: Prenda[]
  ventas: Venta[]
}

/** Genera el seed realista: 2 lotes, ~25 prendas, ~15 ventas. */
export function generarSemilla(): SemillaDatos {
  const loteA: Lote = {
    id: idAleatorio(),
    nombre: 'Paca americana sept',
    costoTotal: 350000, // $3,500.00
    piezasCompradas: 60,
    piezasDescartadas: 4,
    fechaCompra: fechaHaceDias(40),
    notas: 'Paca grande, buena calidad en general.',
  }

  const loteB: Lote = {
    id: idAleatorio(),
    nombre: 'Compra tianguis',
    costoTotal: 80000, // $800.00
    piezasCompradas: 12,
    piezasDescartadas: 0,
    fechaCompra: fechaHaceDias(20),
    notas: null,
  }

  const lotes = [loteA, loteB]

  // 18 prendas del lote A (de las 56 piezas válidas, tomamos una muestra para el demo)
  // 7 prendas del lote B, total 25 prendas
  const prendasBase: Prenda[] = []

  for (let i = 0; i < 18; i++) {
    const numeroFoto = (i % 25) + 1
    const { tipo, fotoUrl } = fotoParaNumero(numeroFoto)
    prendasBase.push({
      id: idAleatorio(),
      loteId: loteA.id,
      fotoUrl,
      tipo,
      color: COLORES_DEMO[i % COLORES_DEMO.length],
      talla: TALLAS_DEMO[i % TALLAS_DEMO.length],
      marca: i % 4 === 0 ? 'Zara' : null,
      estado: ESTADOS_DEMO[i % ESTADOS_DEMO.length],
      costo: 0, // se calcula con prorrateo abajo
      costoManual: i === 2, // una prenda con costo manual, de ejemplo
      precioVenta: 8000 + (i % 5) * 1500,
      status: i < 11 ? 'disponible' : i < 14 ? 'apartada' : i < 17 ? 'vendida' : 'descartada',
      creadoEn: fechaHaceDias(38 - i),
    })
  }

  for (let i = 0; i < 7; i++) {
    const numeroFoto = ((i + 18) % 25) + 1
    const { tipo, fotoUrl } = fotoParaNumero(numeroFoto)
    prendasBase.push({
      id: idAleatorio(),
      loteId: loteB.id,
      fotoUrl,
      tipo,
      color: COLORES_DEMO[(i + 3) % COLORES_DEMO.length],
      talla: TALLAS_DEMO[(i + 1) % TALLAS_DEMO.length],
      marca: null,
      estado: ESTADOS_DEMO[(i + 1) % ESTADOS_DEMO.length],
      costo: 0,
      costoManual: false,
      precioVenta: 6000 + (i % 4) * 1000,
      status: i < 5 ? 'disponible' : 'vendida',
      creadoEn: fechaHaceDias(18 - i),
    })
  }

  // Si una prenda está "descartada" no debe entrar al prorrateo del lote vigente;
  // pero para este seed simplificamos: prorrateamos sobre todas las no-descartadas de cada lote.
  const prendasLoteA = prendasBase.filter((p) => p.loteId === loteA.id && p.status !== 'descartada')
  const prendasLoteADescartadas = prendasBase.filter(
    (p) => p.loteId === loteA.id && p.status === 'descartada',
  )
  const prendasLoteAProrrateadas = prorratearLote(
    loteA.costoTotal,
    loteA.piezasCompradas,
    loteA.piezasDescartadas,
    prendasLoteA,
  )
  // Las prendas descartadas conservan un costo informativo (prorrateo base, sin afectar el total)
  const costoBaseDescartadas = Math.floor(
    loteA.costoTotal / (loteA.piezasCompradas - loteA.piezasDescartadas),
  )
  const prendasLoteADescartadasConCosto = prendasLoteADescartadas.map((p) => ({
    ...p,
    costo: costoBaseDescartadas,
  }))

  const prendasLoteB = prendasBase.filter((p) => p.loteId === loteB.id)
  const prendasLoteBProrrateadas = prorratearLote(
    loteB.costoTotal,
    loteB.piezasCompradas,
    loteB.piezasDescartadas,
    prendasLoteB,
  )

  const prendas = [
    ...prendasLoteAProrrateadas,
    ...prendasLoteADescartadasConCosto,
    ...prendasLoteBProrrateadas,
  ]

  // Ventas: para cada prenda con status "vendida", generamos una venta en los últimos 45 días
  const prendasVendidas = prendas.filter((p) => p.status === 'vendida')
  const ventas: Venta[] = prendasVendidas.map((prenda, i) => {
    const diasDesdeAlta = Math.max(
      1,
      Math.floor((Date.now() - new Date(prenda.creadoEn).getTime()) / (1000 * 60 * 60 * 24) - i),
    )
    const diasVenta = Math.min(diasDesdeAlta, 45 - (i % 10))
    // Envío y comisión como % del precio de venta (no un monto fijo), para que
    // nunca superen la ganancia en prendas baratas y el seed luzca siempre sano.
    const costoEnvio = i % 3 === 0 ? 0 : Math.round(prenda.precioVenta * 0.08)
    const comision = i % 4 === 0 ? Math.round(prenda.precioVenta * 0.05) : 0
    return {
      id: idAleatorio(),
      prendaId: prenda.id,
      precioFinal: prenda.precioVenta,
      costoEnvio,
      comision,
      canal: CANALES_DEMO[i % CANALES_DEMO.length],
      fechaVenta: fechaHaceDias(diasVenta),
    }
  })

  // Si faltan ventas para llegar a ~15, generamos ventas adicionales de prendas disponibles
  // simulando que ya se vendieron piezas anteriores (datos puramente de ejemplo histórico).
  const faltan = 15 - ventas.length
  if (faltan > 0) {
    const disponibles = prendas.filter((p) => p.status === 'disponible').slice(0, faltan)
    disponibles.forEach((prenda, i) => {
      ventas.push({
        id: idAleatorio(),
        prendaId: prenda.id,
        precioFinal: prenda.precioVenta - 500,
        costoEnvio: 0,
        comision: 0,
        canal: CANALES_DEMO[(i + 1) % CANALES_DEMO.length],
        fechaVenta: fechaHaceDias(40 - i * 2),
      })
    })
  }

  return { lotes, prendas, ventas }
}

export type { StatusPrenda }
