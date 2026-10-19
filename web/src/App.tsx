import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { ToastProvider } from '@/components/Toast'
import { TemaProvider } from '@/components/TemaProvider'
import { VocabularioProvider } from '@/components/Vocabulario'
import { SesionProvider, RutaProtegida, PantallaLogin } from '@/components/AuthGate'
import { PaginaInfo } from '@/features/info/PaginaInfo'
import { PaginaPrivacidad, PaginaTerminos, PaginaCookies } from '@/features/legal/PaginasLegales'
import { NoEncontrada } from '@/features/NoEncontrada'
import { AvisoCookies } from '@/components/AvisoCookies'
import { PaginaInicio } from '@/features/dashboard/PaginaInicio'
import { PaginaInventario } from '@/features/inventario/PaginaInventario'
import { PaginaDetallePrenda } from '@/features/inventario/PaginaDetallePrenda'
import { PaginaAltaPrenda } from '@/features/alta-prenda/PaginaAltaPrenda'
import { PaginaLotes } from '@/features/lotes/PaginaLotes'
import { PaginaDetalleLote } from '@/features/lotes/PaginaDetalleLote'
import { PaginaResumen } from '@/features/dashboard/PaginaResumen'

function App() {
  return (
    <TemaProvider>
      <VocabularioProvider>
      <ToastProvider>
        <BrowserRouter>
          <SesionProvider>
            <Routes>
              {/* Públicas: no piden sesión. */}
              <Route path="/" element={<PaginaInfo />} />
              <Route path="/info" element={<Navigate to="/" replace />} />
              <Route path="/login" element={<PantallaLogin />} />
              <Route path="/privacidad" element={<PaginaPrivacidad />} />
              <Route path="/terminos" element={<PaginaTerminos />} />
              <Route path="/cookies" element={<PaginaCookies />} />

              {/* La app: sin sesión, RutaProtegida manda a /login. */}
              <Route element={<RutaProtegida />}>
                <Route path="/app" element={<Layout />}>
                  <Route index element={<PaginaInicio />} />
                  <Route path="inventario" element={<PaginaInventario />} />
                  <Route path="inventario/:id" element={<PaginaDetallePrenda />} />
                  <Route path="nueva" element={<PaginaAltaPrenda />} />
                  <Route path="lotes" element={<PaginaLotes />} />
                  <Route path="lotes/:id" element={<PaginaDetalleLote />} />
                  <Route path="resumen" element={<PaginaResumen />} />
                </Route>
              </Route>
              <Route path="*" element={<NoEncontrada />} />
            </Routes>
            <AvisoCookies />
          </SesionProvider>
        </BrowserRouter>
      </ToastProvider>
      </VocabularioProvider>
    </TemaProvider>
  )
}

export default App
