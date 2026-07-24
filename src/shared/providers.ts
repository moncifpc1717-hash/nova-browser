/**
 * The catalog of AI providers Nova ships with.
 *
 * This is static metadata (labels, default endpoints, known models). Live state
 * — which key is configured, which model is active — is layered on top by the
 * main process ProviderRegistry. Keeping the catalog in `shared` means the
 * settings UI can render the full list without a round-trip.
 */
import type { ProviderId } from './types'

export interface ProviderCatalogEntry {
  id: ProviderId
  label: string
  requiresKey: boolean
  baseUrl: string
  models: string[]
  /** The style of the HTTP API, which selects the adapter implementation. */
  api: 'openai' | 'anthropic' | 'gemini' | 'ollama'
  docsUrl: string
}

export const PROVIDER_CATALOG: Record<ProviderId, ProviderCatalogEntry> = {
  openai: {
    id: 'openai',
    label: 'OpenAI',
    requiresKey: true,
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'o4-mini'],
    api: 'openai',
    docsUrl: 'https://platform.openai.com/api-keys'
  },
  anthropic: {
    id: 'anthropic',
    label: 'Claude',
    requiresKey: true,
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-sonnet-4-5', 'claude-opus-4-1', 'claude-3-5-haiku-latest'],
    api: 'anthropic',
    docsUrl: 'https://console.anthropic.com/settings/keys'
  },
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    requiresKey: true,
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
    api: 'gemini',
    docsUrl: 'https://aistudio.google.com/app/apikey'
  },
  grok: {
    id: 'grok',
    label: 'Grok (xAI)',
    requiresKey: true,
    // xAI exposes an OpenAI-compatible surface, so it reuses that adapter.
    baseUrl: 'https://api.x.ai/v1',
    models: ['grok-4', 'grok-3', 'grok-3-mini'],
    api: 'openai',
    docsUrl: 'https://console.x.ai'
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    requiresKey: true,
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    api: 'openai',
    docsUrl: 'https://platform.deepseek.com/api_keys'
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama (Local)',
    requiresKey: false,
    baseUrl: 'http://localhost:11434',
    models: ['llama3.2', 'qwen2.5', 'mistral', 'phi4'],
    api: 'ollama',
    docsUrl: 'https://ollama.com'
  }
}

export const DEFAULT_PROVIDER: ProviderId = 'openai'

export const PROVIDER_ORDER: ProviderId[] = [
  'openai',
  'anthropic',
  'gemini',
  'grok',
  'deepseek',
  'ollama'
]
