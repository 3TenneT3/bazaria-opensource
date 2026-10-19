import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// www.example.com sirve el sitio, pero la API y el login solo funcionan en el dominio raíz.
if (window.location.hostname.startsWith('www.')) {
  const { protocol, hostname, pathname, search, hash } = window.location
  window.location.replace(`${protocol}//${hostname.slice(4)}${pathname}${search}${hash}`)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
