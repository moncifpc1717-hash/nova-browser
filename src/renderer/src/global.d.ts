/**
 * Ambient declaration that types the `window.nova` bridge exposed by the
 * preload. Because the renderer never imports the preload directly, this is how
 * the React app learns the shape of the API — and gets full autocomplete and
 * compile-time checking against the shared `NovaApi` contract.
 */
import type { NovaApi } from '@shared/api'

declare global {
  interface Window {
    nova: NovaApi
  }
}

export {}
