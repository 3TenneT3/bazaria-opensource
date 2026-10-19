import { Link } from 'react-router-dom'
import { Moon, Sun, Camera, Boxes, Receipt, PiggyBank, FileSpreadsheet, WifiOff, ShieldCheck, Trash2 } from 'lucide-react'
import { PieSitio } from '@/components/PieSitio'
import { useTema, SKINS } from '@/components/TemaProvider'
import { useVocabulario } from '@/components/Vocabulario'
import { DECORACION } from '@/lib/decoracion'
import { useTitulo } from '@/features/legal/PaginaLegal'
import { RESPONSABLE } from '@/features/legal/responsable'

const FUNCIONES = [
  { icono: Camera, titulo: 'Una foto por prenda', texto: 'Sube la foto, anota tipo, talla y marca. Tu inventario se ve como tu tienda, no como una hoja de cálculo.' },
  { icono: Boxes, titulo: 'La paca se reparte sola', texto: 'Dile cuánto pagaste y cuántas piezas trae. Descuenta las descartadas y cada prenda recibe su costo, exacto al centavo.' },
  { icono: Receipt, titulo: 'Ganancia real por venta', texto: 'Resta costo, envío y comisión. Ves cuánto te quedó de verdad, no cuánto cobraste.' },
  { icono: PiggyBank, titulo: 'Capital parado', texto: 'Cuánto dinero tienes en ropa sin vender y qué prendas llevan más de 30 días estancadas.' },
  { icono: FileSpreadsheet, titulo: 'Excel de ida y vuelta', texto: 'Importa tu inventario con una plantilla y exporta tus ventas cuando tu contador las pida.' },
  { icono: WifiOff, titulo: 'Sigue sin señal', texto: 'Registra prendas y ventas en el tianguis aunque no haya internet. Se guardan en tu teléfono y se suben solas al reconectar.' },
]

const PASOS = [
  { n: '1', titulo: 'Registra la paca', texto: 'Paca americana de septiembre: $3,500, 60 piezas, 4 descartadas.' },
  { n: '2', titulo: 'Bazaria hace la cuenta', texto: '56 piezas útiles: cada prenda te costó $62.50.' },
  { n: '3', titulo: 'Vende y mira tu ganancia', texto: 'La vendes en $150 con $25 de envío: te quedan $62.50 limpios.' },
]

// Estéticas que se pueden probar desde la landing tocando la mascota.
const ESTETICAS = SKINS.filter((s) => s.grupo === 'estetica')

const PREGUNTAS = [
  { p: '¿Cuánto cuesta?', r: 'Usar Bazaria es gratis. No hay planes ni tarjeta de por medio.' },
  { p: '¿Necesito crear una cuenta?', r: 'Entras con tu cuenta de Google. Solo usamos tu correo para identificarte y tu inventario es solo tuyo.' },
  { p: '¿Funciona en el celular?', r: 'Sí, está pensada para el celular. Instálala desde el navegador y úsala incluso sin señal: lo que captures se sube cuando vuelva la conexión. La primera vez necesitas internet para iniciar sesión.' },
  { p: '¿Qué pasa con mis datos?', r: 'No los vendemos ni los usamos para publicidad. Puedes exportarlos a Excel y eliminar tu cuenta cuando quieras.' },
  { p: '¿Puedo tener mi propia instalación?', r: 'Sí. El código es abierto (MIT), así que puedes instalarlo por tu cuenta sin costo. Si prefieres que lo alojemos en nuestros servidores, eso tiene un costo: escríbenos y lo platicamos.' },
]

export function PaginaInfo() {
  useTitulo('Bazaria · Cuánto te costó, cuánto ganas de verdad')
  const { tema, alternarTema, skin, setSkin } = useTema()
  const { modo, setModo } = useVocabulario()
  const neutro = modo === 'general'
  // Desde un color básico, la mascota muestra la primera estética para invitar a probarla.
  const actual = ESTETICAS.findIndex((e) => e.id === skin)
  const siguiente = ESTETICAS[(actual + 1) % ESTETICAS.length]
  const mascota = DECORACION[skin]?.mascota ?? ESTETICAS[0].vista

  return (
    <div className="landing bg-libreta min-h-svh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <span className="font-display text-2xl font-bold text-lila-600 dark:text-lila-300">Bazaria</span>
        <nav aria-label="Principal" className="flex items-center gap-2 text-sm font-semibold">
          <a href="#funciones" className="hidden px-3 py-2 hover:underline sm:block">Funciones</a>
          <a href="#como-funciona" className="hidden px-3 py-2 hover:underline sm:block">Cómo funciona</a>
          <a href="#preguntas" className="hidden px-3 py-2 hover:underline sm:block">Preguntas</a>
          <button
            onClick={alternarTema}
            aria-label={tema === 'claro' ? 'Activar modo oscuro' : 'Activar modo claro'}
            className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
          >
            {tema === 'claro' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <Link to="/login" className="min-h-11 rounded-xl bg-lila-600 px-4 py-2.5 text-white hover:bg-lila-700">
            Entrar
          </Link>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-5xl items-center gap-10 px-5 pb-16 pt-8 md:grid-cols-2 md:pt-16">
          <div>
            <p className="inline-block rounded-full bg-lila-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-lila-700 dark:bg-white/10 dark:text-lila-300">
              {neutro ? 'Para quien vende en bazares e Instagram' : 'Para quien vende ropa por Instagram'}
            </p>
            <button
              type="button"
              onClick={() => setModo(neutro ? 'ropa' : 'general')}
              aria-pressed={neutro}
              className="mt-3 flex min-h-11 items-center gap-2 rounded-full border-2 border-dashed border-lila-500/60 px-4 text-left text-sm font-semibold text-lila-700 hover:bg-lila-50 dark:text-lila-300 dark:hover:bg-white/10"
            >
              {neutro ? (
                <>✓ Modo neutro activado · <span className="underline">volver a ropa</span></>
              ) : (
                <>¿No vendes ropa? No te preocupes: <span className="underline">activar modo neutro</span></>
              )}
            </button>
            <h1 className="mt-4 font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Cuánto te costó.
              <br />
              <span className="text-lila-600 dark:text-lila-300">Cuánto ganas de verdad.</span>
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-tinta/80 dark:text-tinta-dark/80">
              Bazaria reparte el costo de {neutro ? 'tu lote entre cada artículo' : 'tu paca entre cada prenda'} y te dice cuánto te queda limpio después de envío y
              comisiones. Gratis, de código abierto y hecha para el celular.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/login"
                className="flex min-h-12 items-center rounded-2xl bg-lila-600 px-6 font-semibold text-white hover:bg-lila-700"
              >
                Empezar gratis
              </Link>
              <a
                href="#como-funciona"
                className="flex min-h-12 items-center rounded-2xl border-2 border-lila-500 px-6 font-semibold hover:bg-lila-50 dark:hover:bg-white/10"
              >
                Ver cómo funciona
              </a>
            </div>
          </div>

          {/* Tarjeta de ejemplo (maqueta, no es una captura) */}
          <div className="relative mx-auto w-full max-w-sm">
            <button
              type="button"
              onClick={() => setSkin(siguiente.id)}
              aria-label={`Probar la estética ${siguiente.nombre}`}
              title={`Probar la estética ${siguiente.nombre}`}
              className="group absolute -right-4 -top-20 z-10 flex flex-col items-center rounded-2xl"
            >
              <span className="cartel-pruebame relative -mb-1 rounded-lg bg-lila-600 px-2.5 py-1 font-display text-xs font-bold uppercase tracking-wide text-white shadow-md">
                ¡Pruébame!
                <span className="absolute left-1/2 top-full -translate-x-1/2 border-x-[6px] border-t-[6px] border-x-transparent border-t-lila-600" aria-hidden="true" />
              </span>
              <img
                src={mascota}
                alt=""
                className="h-24 w-24 object-contain transition-transform duration-300 ease-out group-hover:rotate-12 group-hover:scale-110 group-active:scale-95"
              />
            </button>
            <div className="rounded-3xl border-2 border-lila-500 bg-white p-5 shadow-lg dark:bg-superficie-dark">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-rosa-100 text-4xl dark:bg-white/10" aria-hidden="true">{neutro ? '☕' : '👚'}</div>
                <div>
                  <p className="font-display text-lg font-bold">{neutro ? 'Taza vintage · 350 ml' : 'Blusa lila · M'}</p>
                  <p className="text-sm text-tinta/70 dark:text-tinta-dark/70">{neutro ? 'Lote mercado sept' : 'Paca americana sept'}</p>
                </div>
              </div>
              <dl className="mt-5 space-y-2 text-sm">
                <div className="flex justify-between"><dt>Te costó</dt><dd className="font-semibold">$62.50</dd></div>
                <div className="flex justify-between"><dt>Precio de venta</dt><dd className="font-semibold">$150.00</dd></div>
                <div className="flex justify-between"><dt>Envío</dt><dd className="font-semibold">−$25.00</dd></div>
                <div className="flex justify-between"><dt>Comisión (pago en efectivo)</dt><dd className="font-semibold">$0.00</dd></div>
                <div className="flex justify-between border-t border-black/10 pt-3 text-base dark:border-white/10">
                  <dt className="font-bold">Ganaste</dt>
                  <dd className="font-display text-xl font-bold text-menta-500">$62.50</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        {/* Funciones */}
        <section id="funciones" className="mx-auto max-w-5xl scroll-mt-4 px-5 py-14">
          <h2 className="font-display text-3xl font-bold tracking-tight">Todo lo que necesitas, nada de sobra</h2>
          <p className="mt-2 max-w-xl text-tinta/80 dark:text-tinta-dark/80">
            Pensada para quien lleva su tienda desde el celular y no quiere pelearse con hojas de cálculo.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FUNCIONES.map(({ icono: Icono, titulo, texto }) => (
              <article key={titulo} className="rounded-3xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-superficie-dark">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lila-100 text-lila-700 dark:bg-white/10 dark:text-lila-300">
                  <Icono size={22} aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-display text-lg font-bold">{titulo}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-tinta/80 dark:text-tinta-dark/80">{texto}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Cómo funciona */}
        <section id="como-funciona" className="mx-auto max-w-5xl scroll-mt-4 px-5 py-14">
          <h2 className="font-display text-3xl font-bold tracking-tight">Así de simple</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {PASOS.map((paso) => (
              <li key={paso.n} className="rounded-3xl bg-lila-50 p-6 dark:bg-white/5">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-lila-600 font-display text-lg font-bold text-white">
                  {paso.n}
                </span>
                <h3 className="mt-4 font-display text-lg font-bold">{paso.titulo}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-tinta/80 dark:text-tinta-dark/80">{paso.texto}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Abierto y tuyo */}
        <section className="mx-auto max-w-5xl px-5 py-14">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-superficie-dark">
              <ShieldCheck size={26} className="text-menta-500" aria-hidden="true" />
              <h3 className="mt-3 font-display text-xl font-bold">Código abierto, licencia MIT</h3>
              <p className="mt-2 text-sm leading-relaxed text-tinta/80 dark:text-tinta-dark/80">
                Puedes revisar cómo funciona, instalarla por tu cuenta o adaptarla a tu negocio. Usar la app alojada en
                example.com es gratis; una instalación propia en nuestros servidores tiene un costo.
              </p>
            </div>
            <div className="rounded-3xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-superficie-dark">
              <Trash2 size={26} className="text-rosa-500" aria-hidden="true" />
              <h3 className="mt-3 font-display text-xl font-bold">Tus datos son tuyos</h3>
              <p className="mt-2 text-sm leading-relaxed text-tinta/80 dark:text-tinta-dark/80">
                Sin publicidad ni rastreadores. Solo usamos tu correo para identificarte, exportas todo a Excel y borras tu
                cuenta cuando quieras. Lee el{' '}
                <Link to="/privacidad" className="font-semibold underline">aviso de privacidad</Link>.
              </p>
            </div>
          </div>
        </section>

        {/* Preguntas */}
        <section id="preguntas" className="mx-auto max-w-3xl scroll-mt-4 px-5 py-14">
          <h2 className="font-display text-3xl font-bold tracking-tight">Preguntas frecuentes</h2>
          <div className="mt-6 divide-y divide-black/10 rounded-3xl border border-black/10 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-superficie-dark">
            {PREGUNTAS.map(({ p, r }) => (
              <details key={p} className="group px-5 py-4">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-display font-bold">
                  {p}
                  <span aria-hidden="true" className="text-lila-600 transition-transform group-open:rotate-45 dark:text-lila-300">+</span>
                </summary>
                <p className="max-w-prose pb-2 pt-1 text-sm leading-relaxed text-tinta/80 dark:text-tinta-dark/80">{r}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Cierre */}
        <section className="mx-auto max-w-3xl px-5 pb-20 pt-6 text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight">Deja de adivinar cuánto ganas</h2>
          <p className="mt-3 text-tinta/80 dark:text-tinta-dark/80">Entra con tu cuenta de Google y registra tu primera paca en minutos.</p>
          <Link
            to="/login"
            className="mt-6 inline-flex min-h-12 items-center rounded-2xl bg-lila-600 px-8 font-semibold text-white hover:bg-lila-700"
          >
            Empezar gratis
          </Link>
          <p className="mt-8 max-w-prose text-sm text-tinta/80 dark:text-tinta-dark/80">
            ¿Quieres tu propia instalación alojada por nosotros?{' '}
            <a
              className="font-semibold underline"
              href={`https://wa.me/${RESPONSABLE.whatsapp}?text=${encodeURIComponent('Hola, me interesa una instalación propia de Bazaria.')}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Escríbenos por WhatsApp
            </a>{' '}
            o a <a className="font-semibold underline" href={`mailto:${RESPONSABLE.correo}`}>{RESPONSABLE.correo}</a>.
          </p>
        </section>
      </main>

      <PieSitio />
    </div>
  )
}
