import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// Auto-recover from stale-bundle errors after a Vercel deploy.
// React.lazy() pages reference chunk filenames with content hashes. When a
// new deploy lands, the old hashes 404. Vite fires `vite:preloadError` which
// we catch and force a single reload — fetching the new index.html + chunks.
// The sessionStorage flag prevents infinite reload loops if the chunk really
// is gone (CDN propagation glitch, network issue, etc).
const RELOAD_FLAG = 'vite-preload-error-reload'
if (sessionStorage.getItem(RELOAD_FLAG)) {
  // Previous reload already happened — clear flag and let the error bubble
  // up to ErrorBoundary so the user at least sees something instead of
  // looping forever.
  sessionStorage.removeItem(RELOAD_FLAG)
} else {
  window.addEventListener('vite:preloadError', (event) => {
    sessionStorage.setItem(RELOAD_FLAG, '1')
    event.preventDefault()
    window.location.reload()
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
