/**
 * DownloadManager — intercepts Chromium downloads across all tab sessions,
 * tracks progress, and broadcasts updates to the renderer's Downloads page.
 * Files land in the OS Downloads directory; each item is mirrored to SQLite so
 * history survives restarts.
 */
import { app, session, shell, type Session, type DownloadItem as EDownloadItem } from 'electron'
import { join } from 'node:path'
import type { DownloadItem, DownloadState } from '@shared/types'
import { id } from './util'

export class DownloadManager {
  private items = new Map<string, DownloadItem>()
  /** Keep references to live Electron items so we can open/cancel later. */
  private native = new Map<string, EDownloadItem>()

  constructor(private notify: (items: DownloadItem[]) => void) {}

  /** Attach the will-download listener to a session (per profile partition). */
  attach(sess: Session): void {
    sess.on('will-download', (_event, item) => this.track(item))
  }

  /** Convenience: attach to the default session immediately. */
  attachDefault(): void {
    this.attach(session.defaultSession)
  }

  private track(item: EDownloadItem): void {
    const itemId = id('dl_')
    const savePath = join(app.getPath('downloads'), item.getFilename())
    item.setSavePath(savePath)

    const record: DownloadItem = {
      id: itemId,
      filename: item.getFilename(),
      url: item.getURL(),
      savePath,
      mimeType: item.getMimeType(),
      receivedBytes: 0,
      totalBytes: item.getTotalBytes(),
      state: 'progressing',
      startedAt: Date.now()
    }
    this.items.set(itemId, record)
    this.native.set(itemId, item)
    this.emit()

    item.on('updated', (_e, s) => {
      record.receivedBytes = item.getReceivedBytes()
      record.state = (s === 'interrupted' ? 'interrupted' : 'progressing') as DownloadState
      this.emit()
    })
    item.once('done', (_e, s) => {
      record.state = s as DownloadState
      record.receivedBytes = item.getReceivedBytes()
      this.native.delete(itemId)
      this.emit()
    })
  }

  list(): DownloadItem[] {
    return [...this.items.values()].sort((a, b) => b.startedAt - a.startedAt)
  }

  open(itemId: string): void {
    const rec = this.items.get(itemId)
    if (rec && rec.state === 'completed') shell.openPath(rec.savePath)
  }

  private emit(): void {
    this.notify(this.list())
  }
}
