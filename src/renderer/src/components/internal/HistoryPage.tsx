/**
 * HistoryPage — searchable, reverse-chronological browsing history. Clicking an
 * entry opens it; each row can be removed, and the whole log can be cleared.
 */
import { useEffect, useState } from 'react'
import { Search, Trash2, Globe } from 'lucide-react'
import type { HistoryEntry } from '@shared/types'
import { submitOmni } from '../../lib/controller'
import { PageShell } from './PageShell'

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return new Date(ts).toLocaleDateString()
}

export function HistoryPage(): JSX.Element {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [query, setQuery] = useState('')

  const load = async (q?: string) => setEntries(await window.nova.history.list(q))

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    const t = setTimeout(() => void load(query), 150)
    return () => clearTimeout(t)
  }, [query])

  return (
    <PageShell
      title="History"
      description={`${entries.length} recent ${entries.length === 1 ? 'page' : 'pages'}`}
      actions={
        <button
          onClick={async () => {
            await window.nova.history.clear()
            void load()
          }}
          className="flex items-center gap-1.5 rounded-lg bg-white/6 px-3 py-1.5 text-xs text-ink-soft transition-colors hover:bg-accent-rose/20 hover:text-accent-rose"
        >
          <Trash2 size={13} /> Clear all
        </button>
      }
    >
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
        <Search size={15} className="text-ink-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search history…"
          className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
        />
      </div>

      <div className="space-y-0.5">
        {entries.map((e) => (
          <div
            key={e.id}
            className="group flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-white/5"
          >
            <button onClick={() => void submitOmni(e.url)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              {e.favicon ? (
                <img src={e.favicon} alt="" className="h-4 w-4 shrink-0 rounded-sm" />
              ) : (
                <Globe size={15} className="shrink-0 text-ink-faint" />
              )}
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{e.title || e.url}</span>
              <span className="shrink-0 truncate text-xs text-ink-faint">{new URL(e.url).hostname}</span>
            </button>
            <span className="shrink-0 text-[11px] text-ink-faint">{timeAgo(e.visitedAt)}</span>
            <button
              onClick={async () => {
                await window.nova.history.delete(e.id)
                void load(query)
              }}
              className="shrink-0 rounded-md p-1 text-ink-faint opacity-0 transition-opacity hover:text-accent-rose group-hover:opacity-100"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="py-16 text-center text-sm text-ink-faint">No history yet.</div>
        )}
      </div>
    </PageShell>
  )
}
