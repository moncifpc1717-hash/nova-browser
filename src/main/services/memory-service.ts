/**
 * MemoryService — Nova's long-term memory of the user: facts, habits, writing
 * style, saved prompts, tasks, and notes. Injected into AI system prompts so
 * the browser feels personal and continuous across sessions.
 */
import type { MemoryEntry, MemoryKind } from '@shared/types'
import { id } from '../core/util'
import type { Database } from './database'

export class MemoryService {
  constructor(private db: Database) {}

  list(kind?: MemoryKind): MemoryEntry[] {
    const rows = kind
      ? this.db.query<Row>('SELECT * FROM memory WHERE kind = ? ORDER BY created_at DESC', [kind])
      : this.db.query<Row>('SELECT * FROM memory ORDER BY created_at DESC')
    return rows.map(toEntry)
  }

  add(kind: MemoryKind, content: string): MemoryEntry {
    const entry: MemoryEntry = { id: id('m_'), kind, content, createdAt: Date.now() }
    this.db.run('INSERT INTO memory(id, kind, content, created_at) VALUES(?, ?, ?, ?)', [
      entry.id,
      entry.kind,
      entry.content,
      entry.createdAt
    ])
    return entry
  }

  remove(entryId: string): void {
    this.db.run('DELETE FROM memory WHERE id = ?', [entryId])
  }

  /**
   * Build a compact context block for injection into an LLM system prompt.
   * Capped so it never dominates the context window.
   */
  buildContextBlock(maxItems = 20): string {
    const items = this.list().slice(0, maxItems)
    if (items.length === 0) return ''
    const lines = items.map((m) => `- (${m.kind}) ${m.content}`)
    return `What Nova remembers about the user:\n${lines.join('\n')}`
  }
}

interface Row {
  id: string
  kind: MemoryKind
  content: string
  created_at: number
}

function toEntry(r: Row): MemoryEntry {
  return { id: r.id, kind: r.kind, content: r.content, createdAt: r.created_at }
}
