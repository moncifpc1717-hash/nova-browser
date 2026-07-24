/**
 * HistoryService — records every top-level navigation and supports search and
 * clearing. De-dupes rapid re-visits to the same URL within a short window so
 * the timeline stays readable.
 */
import type { HistoryEntry } from '@shared/types'
import { id } from '../core/util'
import type { Database } from './database'

export class HistoryService {
  constructor(private db: Database) {}

  record(url: string, title: string, favicon: string | null): void {
    if (!/^https?:/i.test(url)) return // don't log internal pages
    const recent = this.db.get<{ id: string; visited_at: number }>(
      'SELECT id, visited_at FROM history WHERE url = ? ORDER BY visited_at DESC LIMIT 1',
      [url]
    )
    const now = Date.now()
    if (recent && now - recent.visited_at < 30_000) {
      this.db.run('UPDATE history SET visited_at = ?, title = ? WHERE id = ?', [now, title, recent.id])
      return
    }
    this.db.run(
      'INSERT INTO history(id, url, title, favicon, visited_at) VALUES(?, ?, ?, ?, ?)',
      [id('h_'), url, title, favicon, now]
    )
  }

  list(query?: string, limit = 300): HistoryEntry[] {
    const rows = query
      ? this.db.query<Row>(
          `SELECT * FROM history WHERE url LIKE ? OR title LIKE ? ORDER BY visited_at DESC LIMIT ?`,
          [`%${query}%`, `%${query}%`, limit]
        )
      : this.db.query<Row>('SELECT * FROM history ORDER BY visited_at DESC LIMIT ?', [limit])
    return rows.map(toEntry)
  }

  delete(entryId: string): void {
    this.db.run('DELETE FROM history WHERE id = ?', [entryId])
  }

  clear(): void {
    this.db.run('DELETE FROM history')
  }
}

interface Row {
  id: string
  url: string
  title: string
  favicon: string | null
  visited_at: number
}

function toEntry(r: Row): HistoryEntry {
  return { id: r.id, url: r.url, title: r.title, favicon: r.favicon, visitedAt: r.visited_at }
}
