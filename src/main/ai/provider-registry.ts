/**
 * ProviderRegistry — the authority on AI provider configuration.
 *
 * Responsibilities:
 *   - Persist API keys, encrypted at rest via the OS keychain (safeStorage),
 *     stored as base64 ciphertext in the `kv` table. Plaintext keys never hit
 *     disk and are never sent to the renderer.
 *   - Track the active provider and each provider's selected model.
 *   - Construct the correct `ChatAdapter` on demand, wiring in base URL + key.
 *
 * The chat service and agent runner call `adapterFor()` and get a ready-to-use,
 * provider-agnostic adapter — they never learn which backend is active.
 */
import { safeStorage } from 'electron'
import type { ProviderConfig, ProviderId } from '@shared/types'
import { PROVIDER_CATALOG, PROVIDER_ORDER } from '@shared/providers'
import type { Database } from '../services/database'
import type { SettingsService } from '../services/settings-service'
import type { ChatAdapter } from './providers/types'
import { OpenAIAdapter } from './providers/openai-adapter'
import { AnthropicAdapter } from './providers/anthropic-adapter'
import { GeminiAdapter } from './providers/gemini-adapter'
import { OllamaAdapter } from './providers/ollama-adapter'

export class ProviderRegistry {
  /** In-memory plaintext key cache, hydrated lazily from encrypted storage. */
  private keyCache = new Map<ProviderId, string>()
  /** Per-provider selected model, defaulting to the catalog's first entry. */
  private models = new Map<ProviderId, string>()

  constructor(private db: Database, private settings: SettingsService) {
    for (const id of PROVIDER_ORDER) {
      const saved = this.db.get<{ value: string }>('SELECT value FROM kv WHERE key = ?', [
        this.modelKey(id)
      ])
      this.models.set(id, saved?.value ?? PROVIDER_CATALOG[id].models[0])
    }
  }

  private keyKey(id: ProviderId): string {
    return `provider_key_${id}`
  }
  private modelKey(id: ProviderId): string {
    return `provider_model_${id}`
  }

  /** Decrypt and return the stored API key for a provider, or null. */
  private loadKey(id: ProviderId): string | null {
    if (this.keyCache.has(id)) return this.keyCache.get(id)!
    const row = this.db.get<{ value: string }>('SELECT value FROM kv WHERE key = ?', [
      this.keyKey(id)
    ])
    if (!row) return null
    try {
      const plain = safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(Buffer.from(row.value, 'base64'))
        : Buffer.from(row.value, 'base64').toString('utf8')
      this.keyCache.set(id, plain)
      return plain
    } catch {
      return null
    }
  }

  setKey(id: ProviderId, key: string): void {
    const trimmed = key.trim()
    if (!trimmed) {
      this.db.run('DELETE FROM kv WHERE key = ?', [this.keyKey(id)])
      this.keyCache.delete(id)
      return
    }
    const stored = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(trimmed).toString('base64')
      : Buffer.from(trimmed, 'utf8').toString('base64')
    this.db.run(
      'INSERT INTO kv(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [this.keyKey(id), stored]
    )
    this.keyCache.set(id, trimmed)
  }

  setModel(id: ProviderId, model: string): void {
    this.models.set(id, model)
    this.db.run(
      'INSERT INTO kv(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [this.modelKey(id), model]
    )
  }

  setActiveProvider(id: ProviderId): void {
    this.settings.set({ activeProvider: id })
  }

  activeProvider(): ProviderId {
    return this.settings.get().activeProvider
  }

  private isConfigured(id: ProviderId): boolean {
    const entry = PROVIDER_CATALOG[id]
    return entry.requiresKey ? !!this.loadKey(id) : true
  }

  /** The full provider list with live config state, for the settings UI. */
  list(): ProviderConfig[] {
    return PROVIDER_ORDER.map((id) => {
      const c = PROVIDER_CATALOG[id]
      return {
        id,
        label: c.label,
        requiresKey: c.requiresKey,
        baseUrl: c.baseUrl,
        models: c.models,
        configured: this.isConfigured(id),
        activeModel: this.models.get(id) ?? c.models[0]
      }
    })
  }

  activeModel(id: ProviderId): string {
    return this.models.get(id) ?? PROVIDER_CATALOG[id].models[0]
  }

  /**
   * Build a ready-to-use adapter for the given provider (defaults to active).
   * Throws a helpful error if a required key is missing so the caller can
   * surface a "configure your provider" prompt rather than a raw 401.
   */
  adapterFor(id: ProviderId = this.activeProvider()): { adapter: ChatAdapter; model: string } {
    const entry = PROVIDER_CATALOG[id]
    const apiKey = this.loadKey(id)
    if (entry.requiresKey && !apiKey) {
      throw new Error(
        `${entry.label} needs an API key. Open Settings → AI Providers to add one, or switch to a local provider.`
      )
    }
    const creds = { apiKey, baseUrl: entry.baseUrl }
    const model = this.activeModel(id)
    switch (entry.api) {
      case 'anthropic':
        return { adapter: new AnthropicAdapter(creds), model }
      case 'gemini':
        return { adapter: new GeminiAdapter(creds), model }
      case 'ollama':
        return { adapter: new OllamaAdapter(creds), model }
      case 'openai':
      default:
        return { adapter: new OpenAIAdapter(creds, entry.label), model }
    }
  }
}
