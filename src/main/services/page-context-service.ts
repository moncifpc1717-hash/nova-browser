/**
 * PageContextService — extracts a readable snapshot of a tab's content for the
 * AI. It injects the same page-controller helper the agent uses and pulls the
 * cleaned text, title, url, and current selection. This is what powers
 * "summarize this page", "translate this", and page-grounded chat.
 */
import type { PageContext } from '@shared/types'
import { INSTALL_SCRIPT, READABLE_EXPR, META_EXPR } from '../ai/agent/page-controller'
import type { TabManager } from '../core/tab-manager'

export class PageContextService {
  constructor(private tabs: TabManager) {}

  async getContext(tabId: string): Promise<PageContext | null> {
    const wc = this.tabs.getWebContents(tabId)
    if (!wc || wc.isDestroyed()) return null

    try {
      await wc.executeJavaScript(INSTALL_SCRIPT, true)
      const meta = (await wc.executeJavaScript(META_EXPR, true)) as {
        url: string
        title: string
        selection: string
      }
      const text = ((await wc.executeJavaScript(READABLE_EXPR, true)) as string) ?? ''
      return {
        tabId,
        url: meta.url,
        title: meta.title,
        text,
        wordCount: text ? text.split(/\s+/).length : 0,
        selection: meta.selection?.trim() ? meta.selection.trim() : null
      }
    } catch {
      return null
    }
  }
}
