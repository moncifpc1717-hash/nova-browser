/**
 * DownloadsPage — live download list with progress bars. Updates in real time
 * via the store, which the controller keeps in sync with the main process's
 * DownloadManager. Completed items open on click.
 */
import { FileDown, Check, CircleAlert, FolderOpen } from 'lucide-react'
import type { DownloadItem } from '@shared/types'
import { useStore } from '../../state/store'
import { PageShell } from './PageShell'

function formatBytes(n: number): string {
  if (!n) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(n) / Math.log(1024))
  return `${(n / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${units[i]}`
}

function Row({ item }: { item: DownloadItem }): JSX.Element {
  const pct = item.totalBytes > 0 ? Math.round((item.receivedBytes / item.totalBytes) * 100) : 0
  const done = item.state === 'completed'
  const failed = item.state === 'interrupted' || item.state === 'cancelled'

  return (
    <div className="rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5">
          {done ? (
            <Check size={16} className="text-accent-mint" />
          ) : failed ? (
            <CircleAlert size={16} className="text-accent-rose" />
          ) : (
            <FileDown size={16} className="text-nova-soft" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-ink">{item.filename}</div>
          <div className="text-xs text-ink-faint">
            {done
              ? formatBytes(item.receivedBytes)
              : failed
                ? 'Failed'
                : `${formatBytes(item.receivedBytes)} of ${formatBytes(item.totalBytes)} · ${pct}%`}
          </div>
        </div>
        {done && (
          <button
            onClick={() => window.nova.downloads.open(item.id)}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-white/6 px-2.5 py-1 text-xs text-ink-soft transition-colors hover:bg-white/12 hover:text-ink"
          >
            <FolderOpen size={13} /> Open
          </button>
        )}
      </div>
      {!done && !failed && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/8">
          <div className="h-full rounded-full bg-nova transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  )
}

export function DownloadsPage(): JSX.Element {
  const downloads = useStore((s) => s.downloads)

  return (
    <PageShell title="Downloads" description={`${downloads.length} ${downloads.length === 1 ? 'file' : 'files'}`}>
      {downloads.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <FileDown size={28} className="text-ink-faint" />
          <div className="text-sm text-ink-faint">Downloads will appear here.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {downloads.map((d) => (
            <Row key={d.id} item={d} />
          ))}
        </div>
      )}
    </PageShell>
  )
}
