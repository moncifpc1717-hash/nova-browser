/**
 * Renderer entry. Mounts the React chrome shell and performs one-time
 * bootstrap: hydrate state from the main process and subscribe to bridge events.
 */
import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { bindBridgeEvents, bootstrap } from './lib/controller'
import './styles/index.css'

const container = document.getElementById('root')!
const root = createRoot(container)
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Kick off data hydration and live event wiring after first paint.
bindBridgeEvents()
void bootstrap()
