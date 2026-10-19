import { Outlet, useLocation } from 'react-router-dom'
import { useEstadoSync } from '@/data/sincronizacion/estado'
import { NavBar } from './NavBar'
import { DemoBanner } from './DemoBanner'

export function Layout() {
  // Cuando llegan datos distintos del servidor, la pantalla vuelve a leerlos. El formulario de alta
  // se excluye para no borrarle lo que la usuaria va escribiendo.
  const { version } = useEstadoSync()
  const { pathname } = useLocation()
  return (
    <div className="bg-libreta min-h-svh pb-24 lg:pb-8 lg:pl-56">
      <DemoBanner />
      <main className="mx-auto max-w-md px-4 py-4 md:max-w-2xl md:px-8 md:py-8 lg:max-w-4xl">
        <Outlet key={pathname.endsWith('/nueva') ? 'nueva' : version} />
      </main>
      <NavBar />
    </div>
  )
}
