/**
 * ProfileService — browsing profiles. Each profile maps to an isolated Electron
 * session partition (persist:profile-<id>), giving separate cookies, storage,
 * and cache. v0.1 tracks profile records and the active id; the TabManager
 * consumes the active partition when spawning web content.
 */
import type { Profile } from '@shared/types'
import { id } from '../core/util'
import type { Database } from './database'

const ACTIVE_KEY = 'active_profile'

export class ProfileService {
  constructor(private db: Database) {
    if (this.list().length === 0) {
      this.add('Personal', '#7c5cff')
    }
  }

  list(): Profile[] {
    return this.db
      .query<Row>('SELECT * FROM profiles ORDER BY created_at ASC')
      .map(toProfile)
  }

  add(name: string, color: string): Profile {
    const p: Profile = { id: id('p_'), name, color, avatar: null, createdAt: Date.now() }
    this.db.run(
      'INSERT INTO profiles(id, name, color, avatar, created_at) VALUES(?, ?, ?, ?, ?)',
      [p.id, p.name, p.color, p.avatar, p.createdAt]
    )
    if (!this.getActiveId()) this.activate(p.id)
    return p
  }

  activate(profileId: string): void {
    this.db.run(
      'INSERT INTO kv(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [ACTIVE_KEY, profileId]
    )
  }

  getActiveId(): string | null {
    const row = this.db.get<{ value: string }>('SELECT value FROM kv WHERE key = ?', [ACTIVE_KEY])
    return row?.value ?? null
  }

  /** The Electron session partition string for the active profile. */
  activePartition(): string {
    const active = this.getActiveId() ?? this.list()[0]?.id ?? 'default'
    return `persist:profile-${active}`
  }
}

interface Row {
  id: string
  name: string
  color: string
  avatar: string | null
  created_at: number
}

function toProfile(r: Row): Profile {
  return { id: r.id, name: r.name, color: r.color, avatar: r.avatar, createdAt: r.created_at }
}
