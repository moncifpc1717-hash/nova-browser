/**
 * VaultService — Nova's password manager.
 *
 * Passwords are encrypted with Electron's `safeStorage`, which delegates to the
 * OS keychain (Keychain on macOS, DPAPI on Windows, libsecret on Linux). We
 * store only the OS-encrypted ciphertext (base64) in SQLite; the plaintext
 * never lives on disk. `reveal()` is the sole path back to plaintext and is
 * gated behind an explicit IPC call from the user.
 */
import { safeStorage } from 'electron'
import type { VaultEntry } from '@shared/types'
import { id, originOf } from '../core/util'
import type { Database } from './database'

export class VaultService {
  constructor(private db: Database) {}

  /** Whether the OS provides real encryption. If false we refuse to store. */
  get available(): boolean {
    return safeStorage.isEncryptionAvailable()
  }

  list(): VaultEntry[] {
    return this.db
      .query<Row>('SELECT * FROM vault ORDER BY origin ASC')
      .map(toEntry)
  }

  /** Upsert a credential keyed by (origin, username). */
  save(rawOrigin: string, username: string, password: string): void {
    if (!this.available) {
      throw new Error('OS secure storage is unavailable; refusing to store password in plaintext.')
    }
    const origin = originOf(rawOrigin) || rawOrigin
    const secret = safeStorage.encryptString(password).toString('base64')
    const existing = this.db.get<{ id: string }>(
      'SELECT id FROM vault WHERE origin = ? AND username = ?',
      [origin, username]
    )
    if (existing) {
      this.db.run('UPDATE vault SET secret = ?, updated_at = ? WHERE id = ?', [
        secret,
        Date.now(),
        existing.id
      ])
    } else {
      this.db.run(
        'INSERT INTO vault(id, origin, username, secret, updated_at) VALUES(?, ?, ?, ?, ?)',
        [id('v_'), origin, username, secret, Date.now()]
      )
    }
  }

  /** Decrypt and return the plaintext password for one entry. */
  reveal(entryId: string): string {
    const row = this.db.get<{ secret: string }>('SELECT secret FROM vault WHERE id = ?', [entryId])
    if (!row) throw new Error('Vault entry not found')
    return safeStorage.decryptString(Buffer.from(row.secret, 'base64'))
  }

  /** Look up a credential for autofill by origin. Returns ciphertext metadata only. */
  findForOrigin(url: string): VaultEntry | null {
    const origin = originOf(url)
    if (!origin) return null
    const row = this.db.get<Row>('SELECT * FROM vault WHERE origin = ? LIMIT 1', [origin])
    return row ? toEntry(row) : null
  }

  remove(entryId: string): void {
    this.db.run('DELETE FROM vault WHERE id = ?', [entryId])
  }
}

interface Row {
  id: string
  origin: string
  username: string
  secret: string
  updated_at: number
}

function toEntry(r: Row): VaultEntry {
  return {
    id: r.id,
    origin: r.origin,
    username: r.username,
    // The API type carries the ciphertext; the UI shows a masked placeholder.
    secret: r.secret,
    updatedAt: r.updated_at
  }
}
