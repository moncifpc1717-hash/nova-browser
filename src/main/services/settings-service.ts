/**
 * SettingsService — typed access to Nova's user settings, stored as a single
 * JSON blob in the `kv` table. Settings are small and read often, so we cache
 * them in memory and only touch SQLite on change.
 */
import type { NovaSettings } from '@shared/types'
import { DEFAULT_PROVIDER } from '@shared/providers'
import type { Database } from './database'

const KEY = 'settings'

const DEFAULTS: NovaSettings = {
  activeProvider: DEFAULT_PROVIDER,
  theme: 'dark',
  language: 'en',
  searchEngine: 'google',
  voiceEnabled: false,
  wakeWord: 'Hey Nova',
  confirmSensitiveActions: true
}

export class SettingsService {
  private cache: NovaSettings

  constructor(private db: Database) {
    const row = db.get<{ value: string }>('SELECT value FROM kv WHERE key = ?', [KEY])
    this.cache = row ? { ...DEFAULTS, ...JSON.parse(row.value) } : { ...DEFAULTS }
  }

  get(): NovaSettings {
    return { ...this.cache }
  }

  set(patch: Partial<NovaSettings>): NovaSettings {
    this.cache = { ...this.cache, ...patch }
    this.db.run(
      'INSERT INTO kv(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [KEY, JSON.stringify(this.cache)]
    )
    return this.get()
  }
}
