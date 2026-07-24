/**
 * BookmarkService — CRUD over saved bookmarks, grouped into simple folders.
 */
import type { Bookmark } from '@shared/types'
import { id } from '../core/util'
import type { Database } from './database'

export class BookmarkService {
  constructor(private db: Database) {}

  list(): Bookmark[] {
    return this.db
      .query<Row>('SELECT * FROM bookmarks ORDER BY created_at DESC')
      .map(toBookmark)
  }

  add(b: Omit<Bookmark, 'id' | 'createdAt'>): Bookmark {
    const entry: Bookmark = { ...b, id: id('b_'), createdAt: Date.now() }
    this.db.run(
      'INSERT INTO bookmarks(id, url, title, favicon, folder, created_at) VALUES(?, ?, ?, ?, ?, ?)',
      [entry.id, entry.url, entry.title, entry.favicon, entry.folder, entry.createdAt]
    )
    return entry
  }

  remove(bookmarkId: string): void {
    this.db.run('DELETE FROM bookmarks WHERE id = ?', [bookmarkId])
  }
}

interface Row {
  id: string
  url: string
  title: string
  favicon: string | null
  folder: string
  created_at: number
}

function toBookmark(r: Row): Bookmark {
  return {
    id: r.id,
    url: r.url,
    title: r.title,
    favicon: r.favicon,
    folder: r.folder,
    createdAt: r.created_at
  }
}
