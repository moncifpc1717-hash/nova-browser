/**
 * BookmarksPage — saved pages grouped by folder. Click to open, remove with the
 * hover action. Bookmarks are added from the toolbar star.
 */
import { useEffect, useState } from 'react'
import { Globe, Trash2, Bookmark as BookmarkIcon } from 'lucide-react'
import type { Bookmark } from '@shared/types'
import { submitOmni } from '../../lib/controller'
import { PageShell } from './PageShell'

export function BookmarksPage(): JSX.Element {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])

  const load = async () => setBookmarks(await window.nova.bookmarks.list())
  useEffect(() => {
    void load()
  }, [])

  const grouped = bookmarks.reduce<Record<string, Bookmark[]>>((acc, b) => {
    ;(acc[b.folder] ??= []).push(b)
    return acc
  }, {})

  return (
    <PageShell title="Bookmarks" description={`${bookmarks.length} saved`}>
      {bookmarks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <BookmarkIcon size={28} className="text-ink-faint" />
          <div className="text-sm text-ink-faint">
            No bookmarks yet. Tap the star in the toolbar to save a page.
          </div>
        </div>
      ) : (
        Object.entries(grouped).map(([folder, items]) => (
          <div key={folder} className="mb-6">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
              {folder}
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {items.map((b) => (
                <div
                  key={b.id}
                  className="group flex items-center gap-3 rounded-xl border border-white/6 bg-white/[0.02] px-3 py-2.5 transition-colors hover:bg-white/[0.06]"
                >
                  <button
                    onClick={() => void submitOmni(b.url)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    {b.favicon ? (
                      <img src={b.favicon} alt="" className="h-4 w-4 shrink-0 rounded-sm" />
                    ) : (
                      <Globe size={15} className="shrink-0 text-ink-faint" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{b.title || b.url}</span>
                  </button>
                  <button
                    onClick={async () => {
                      await window.nova.bookmarks.remove(b.id)
                      void load()
                    }}
                    className="shrink-0 rounded-md p-1 text-ink-faint opacity-0 transition-opacity hover:text-accent-rose group-hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </PageShell>
  )
}
