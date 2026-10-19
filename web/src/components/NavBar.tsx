import { NavLink } from 'react-router-dom'
import { Home, Shirt, Plus, Package, BarChart3 } from 'lucide-react'

const enlaces = [
  { to: '/app', icono: Home, etiqueta: 'Inicio' },
  { to: '/app/inventario', icono: Shirt, etiqueta: 'Inventario' },
  { to: '/app/nueva', icono: Plus, etiqueta: 'Agregar', central: true },
  { to: '/app/lotes', icono: Package, etiqueta: 'Lotes' },
  { to: '/app/resumen', icono: BarChart3, etiqueta: 'Resumen' },
]

export function NavBar() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-white/90 lg:inset-x-auto lg:inset-y-0 lg:left-0 lg:w-56 lg:border-r lg:border-t-0 lg:pt-6 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-white/10 dark:bg-crema-dark/90"
      aria-label="Navegación principal"
    >
      <ul className="mx-auto flex max-w-md items-center justify-between px-2 md:max-w-xl lg:max-w-none lg:flex-col lg:items-stretch lg:justify-start lg:gap-1 lg:px-3">
        {enlaces.map(({ to, icono: Icono, etiqueta, central }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === '/app'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2 text-xs font-medium lg:flex-row lg:gap-3 lg:rounded-xl lg:px-3 lg:py-3 lg:text-sm ${
                  central
                    ? '-mt-5 lg:mt-0'
                    : isActive
                      ? 'text-lila-600 dark:text-lila-300'
                      : 'text-tinta/50 dark:text-tinta-dark/50'
                }`
              }
            >
              {({ isActive }) =>
                central ? (
                  <>
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-lila-500 text-white shadow-lg shadow-lila-500/30">
                      <Icono size={26} strokeWidth={2.2} />
                    </span>
                  </>
                ) : (
                  <>
                    <Icono
                      size={22}
                      strokeWidth={isActive ? 2.4 : 1.8}
                    />
                    <span>{etiqueta}</span>
                  </>
                )
              }
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
