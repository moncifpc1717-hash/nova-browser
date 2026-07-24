/**
 * TabManager — owns the lifecycle of real Chromium tabs.
 *
 * Architecture: the OS window is a `BaseWindow`. The Nova chrome (React shell —
 * sidebar, toolbar, AI panel) renders in one `WebContentsView` that fills the
 * whole window. Each browser tab is its own `WebContentsView` layered on top,
 * positioned to exactly cover the "viewport" rectangle the renderer reports via
 * `setBounds`. Switching tabs = swapping which content view is visible. This is
 * the modern replacement for the deprecated BrowserView API and gives us true,
 * process-isolated Chromium per tab.
 *
 * TabManager also implements `PageBridge`, so the autonomous agent drives the
 * same real tabs the user sees.
 */
import { BaseWindow, WebContentsView, type WebContents } from 'electron'
import type { TabState, InternalPage } from '@shared/types'
import { IPC } from '@shared/ipc'
import { id } from './util'
import type { HistoryService } from '../services/history-service'
import type { ProfileService } from '../services/profile-service'
import type { PageBridge } from '../ai/agent/agent-runner'

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

interface ManagedTab {
  id: string
  view: WebContentsView
  state: TabState
}

/** How Nova's internal React pages are addressed by the renderer's hash router. */
const INTERNAL_PREFIX = 'nova://'

export class TabManager implements PageBridge {
  private tabs = new Map<string, ManagedTab>()
  private order: string[] = []
  private activeId: string | null = null
  private bounds: Rect = { x: 0, y: 0, width: 800, height: 600 }

  constructor(
    private window: BaseWindow,
    private chrome: WebContents,
    private history: HistoryService,
    private profiles: ProfileService,
    /** Resolves the renderer entry so tabs can load internal pages if needed. */
    private rendererUrl: string
  ) {}

  // ── viewport geometry ───────────────────────────────────────────────────────

  /** The renderer reports where web content should paint (right of sidebar). */
  setBounds(bounds: Rect): void {
    this.bounds = bounds
    const active = this.activeId ? this.tabs.get(this.activeId) : null
    if (active && !active.state.internalPage) {
      active.view.setBounds(bounds)
    }
  }

  // ── tab CRUD ────────────────────────────────────────────────────────────────

  create(url = `${INTERNAL_PREFIX}new-tab`): TabState {
    const tabId = id('tab_')
    const view = new WebContentsView({
      webPreferences: {
        partition: this.profiles.activePartition(),
        sandbox: true,
        contextIsolation: true,
        // Web content must NOT get Node — it's untrusted remote code.
        nodeIntegration: false
      }
    })

    const state: TabState = {
      id: tabId,
      title: 'New Tab',
      url,
      favicon: null,
      loadState: 'idle',
      canGoBack: false,
      canGoForward: false,
      isActive: false,
      isPinned: false,
      isAgentControlled: false,
      internalPage: this.internalPageOf(url),
      createdAt: Date.now()
    }

    const tab: ManagedTab = { id: tabId, view, state }
    this.tabs.set(tabId, tab)
    this.order.push(tabId)
    this.wireEvents(tab)

    this.window.contentView.addChildView(view)
    this.loadUrl(tab, url)
    this.activate(tabId)
    return state
  }

  close(tabId: string): void {
    const tab = this.tabs.get(tabId)
    if (!tab) return
    const idx = this.order.indexOf(tabId)
    this.window.contentView.removeChildView(tab.view)
    // WebContentsView cleanup: destroy the underlying contents.
    tab.view.webContents.close()
    this.tabs.delete(tabId)
    this.order = this.order.filter((t) => t !== tabId)

    if (this.activeId === tabId) {
      const next = this.order[idx] ?? this.order[idx - 1] ?? this.order[this.order.length - 1]
      if (next) this.activate(next)
      else {
        this.activeId = null
        this.create() // never leave the user with zero tabs
        return
      }
    }
    this.broadcast()
  }

  activate(tabId: string): void {
    const tab = this.tabs.get(tabId)
    if (!tab) return
    // A tab's native web view is visible only when it is the active tab AND it
    // shows a real web page. For internal tabs the native view stays hidden so
    // the React internal page (rendered in the chrome view *beneath*) shows
    // through — otherwise a blank Chromium view would paint over our UI.
    for (const [otherId, other] of this.tabs) {
      const isActive = otherId === tabId
      other.state.isActive = isActive
      other.view.setVisible(isActive && !other.state.internalPage)
    }
    if (!tab.state.internalPage) {
      tab.view.setBounds(this.bounds)
      // Bring the active web view to the front (above the chrome shell).
      this.window.contentView.addChildView(tab.view)
    }
    this.activeId = tabId
    this.broadcast()
  }

  navigate(tabId: string, url: string): Promise<void> {
    const tab = this.tabs.get(tabId)
    if (!tab) return Promise.resolve()
    return this.loadUrl(tab, url)
  }

  back(tabId: string): void {
    const wc = this.tabs.get(tabId)?.view.webContents
    if (wc?.navigationHistory.canGoBack()) wc.navigationHistory.goBack()
  }

  forward(tabId: string): void {
    const wc = this.tabs.get(tabId)?.view.webContents
    if (wc?.navigationHistory.canGoForward()) wc.navigationHistory.goForward()
  }

  reload(tabId: string): void {
    this.tabs.get(tabId)?.view.webContents.reload()
  }

  reorder(tabId: string, toIndex: number): void {
    const from = this.order.indexOf(tabId)
    if (from < 0) return
    this.order.splice(from, 1)
    this.order.splice(Math.max(0, Math.min(toIndex, this.order.length)), 0, tabId)
    this.broadcast()
  }

  pin(tabId: string, pinned: boolean): void {
    const tab = this.tabs.get(tabId)
    if (!tab) return
    tab.state.isPinned = pinned
    this.broadcast()
  }

  getAll(): TabState[] {
    return this.order.map((tid) => this.tabs.get(tid)!.state).filter(Boolean)
  }

  // ── PageBridge (agent) ───────────────────────────────────────────────────────

  getWebContents(tabId: string): WebContents | null {
    return this.tabs.get(tabId)?.view.webContents ?? null
  }

  async createTab(url: string): Promise<string> {
    const target = url === 'about:blank' ? `${INTERNAL_PREFIX}new-tab` : url
    const state = this.create(target)
    return state.id
  }

  setAgentControlled(tabId: string, controlled: boolean): void {
    const tab = this.tabs.get(tabId)
    if (!tab) return
    tab.state.isAgentControlled = controlled
    this.broadcast()
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private internalPageOf(url: string): InternalPage | null {
    if (!url.startsWith(INTERNAL_PREFIX)) return null
    const page = url.slice(INTERNAL_PREFIX.length).split(/[?#]/)[0]
    const valid: InternalPage[] = ['new-tab', 'settings', 'history', 'bookmarks', 'downloads']
    return valid.includes(page as InternalPage) ? (page as InternalPage) : 'new-tab'
  }

  private loadUrl(tab: ManagedTab, url: string): Promise<void> {
    const internal = this.internalPageOf(url)
    tab.state.internalPage = internal
    tab.state.url = url
    if (internal) {
      // Internal pages render inside the chrome shell, so we hide the web view
      // and let the React app route to the internal page.
      tab.view.setVisible(false)
      tab.state.loadState = 'complete'
      tab.state.title = internalTitle(internal)
      this.broadcast()
      return Promise.resolve()
    }
    tab.view.setVisible(tab.id === this.activeId)
    tab.state.loadState = 'loading'
    this.broadcast()
    return tab.view.webContents.loadURL(url).catch((err) => {
      tab.state.loadState = 'error'
      tab.state.title = 'Failed to load'
      // eslint-disable-next-line no-console
      console.error(`[nova] load failed for ${url}:`, err?.message)
      this.broadcast()
    })
  }

  private wireEvents(tab: ManagedTab): void {
    const wc = tab.view.webContents
    const sync = () => {
      tab.state.canGoBack = wc.navigationHistory.canGoBack()
      tab.state.canGoForward = wc.navigationHistory.canGoForward()
      this.broadcast()
    }

    wc.on('did-start-loading', () => {
      tab.state.loadState = 'loading'
      this.broadcast()
    })
    wc.on('did-stop-loading', () => {
      tab.state.loadState = 'complete'
      sync()
    })
    wc.on('page-title-updated', (_e, title) => {
      tab.state.title = title
      this.history.record(wc.getURL(), title, tab.state.favicon)
      this.broadcast()
    })
    wc.on('page-favicon-updated', (_e, favicons) => {
      tab.state.favicon = favicons[0] ?? null
      this.broadcast()
    })
    wc.on('did-navigate', (_e, url) => {
      tab.state.url = url
      tab.state.internalPage = null
      sync()
    })
    wc.on('did-navigate-in-page', (_e, url) => {
      tab.state.url = url
      sync()
    })
    // Open target=_blank / window.open in a new Nova tab instead of a popup.
    wc.setWindowOpenHandler(({ url }) => {
      this.create(url)
      return { action: 'deny' }
    })
  }

  private broadcast(): void {
    if (!this.chrome.isDestroyed()) {
      this.chrome.send(IPC.TABS_CHANGED, this.getAll())
    }
  }

  /** Get the renderer URL for an internal page (used if we ever load one in-view). */
  internalUrl(page: InternalPage): string {
    return `${this.rendererUrl}#/${page}`
  }
}

function internalTitle(page: InternalPage): string {
  switch (page) {
    case 'new-tab':
      return 'New Tab'
    case 'settings':
      return 'Settings'
    case 'history':
      return 'History'
    case 'bookmarks':
      return 'Bookmarks'
    case 'downloads':
      return 'Downloads'
  }
}
