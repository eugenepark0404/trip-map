import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

if ('serviceWorker' in navigator) {
  // skipWaiting + clientsClaim (vite.config.ts) let a new deploy's service worker take
  // control immediately, but an already-open tab keeps running the JS it already loaded
  // until it reloads — without this, testers kept seeing old behavior after a deploy.
  let reloadedOnce = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadedOnce) return
    reloadedOnce = true
    window.location.reload()
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
