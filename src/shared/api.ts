/**
 * The `window.nova` API contract.
 *
 * The preload script implements this interface over `contextBridge`, and the
 * renderer consumes it. Keeping it as a standalone TypeScript interface means
 * the UI codes against a clean, promise-based surface and never touches raw
 * `ipcRenderer` — that plumbing lives entirely in the preload layer.
 */
import type {
  AgentAction,
  AgentRunState,
  Bookmark,
  ChatMessage,
  DownloadItem,
  HistoryEntry,
  LlmMessage,
  MemoryEntry,
  MemoryKind,
  NovaSettings,
  OmniClassification,
  PageContext,
  Profile,
  ProviderConfig,
  ProviderId,
  TabState,
  VaultEntry
} from './types'

/** Payload the renderer sends to start or continue a chat turn. */
export interface ChatTurnRequest {
  /** Correlates streaming deltas back to the originating request. */
  requestId: string
  messages: LlmMessage[]
  /** When set, the page's context is folded into the system prompt. */
  includePageContext: boolean
  tabId: string | null
}

export interface Unsubscribe {
  (): void
}

export interface NovaApi {
  tabs: {
    create(url?: string): Promise<TabState>
    close(id: string): Promise<void>
    activate(id: string): Promise<void>
    navigate(id: string, url: string): Promise<void>
    back(id: string): Promise<void>
    forward(id: string): Promise<void>
    reload(id: string): Promise<void>
    reorder(id: string, toIndex: number): Promise<void>
    pin(id: string, pinned: boolean): Promise<void>
    getAll(): Promise<TabState[]>
    onChanged(cb: (tabs: TabState[]) => void): Unsubscribe
    /** Tell the main process the rectangle in which to paint web content. */
    setBounds(bounds: { x: number; y: number; width: number; height: number }): void
  }

  omni: {
    classify(input: string): Promise<OmniClassification>
    submit(input: string): Promise<void>
  }

  page: {
    getContext(tabId: string): Promise<PageContext | null>
  }

  ai: {
    listProviders(): Promise<ProviderConfig[]>
    setActiveProvider(id: ProviderId): Promise<void>
    setKey(id: ProviderId, key: string): Promise<void>
    setModel(id: ProviderId, model: string): Promise<void>
    chat(req: ChatTurnRequest): Promise<void>
    abort(requestId: string): Promise<void>
    onDelta(cb: (requestId: string, delta: string) => void): Unsubscribe
    onDone(cb: (requestId: string, full: string) => void): Unsubscribe
    onError(cb: (requestId: string, error: string) => void): Unsubscribe
  }

  agent: {
    run(goal: string, tabId: string | null): Promise<string>
    confirm(runId: string, actionId: string, approved: boolean): Promise<void>
    abort(runId: string): Promise<void>
    onUpdate(cb: (state: AgentRunState) => void): Unsubscribe
  }

  history: {
    list(query?: string): Promise<HistoryEntry[]>
    delete(id: string): Promise<void>
    clear(): Promise<void>
  }

  bookmarks: {
    list(): Promise<Bookmark[]>
    add(b: Omit<Bookmark, 'id' | 'createdAt'>): Promise<Bookmark>
    remove(id: string): Promise<void>
  }

  downloads: {
    list(): Promise<DownloadItem[]>
    open(id: string): Promise<void>
    onChanged(cb: (items: DownloadItem[]) => void): Unsubscribe
  }

  vault: {
    list(): Promise<VaultEntry[]>
    save(origin: string, username: string, password: string): Promise<void>
    reveal(id: string): Promise<string>
    remove(id: string): Promise<void>
  }

  memory: {
    list(kind?: MemoryKind): Promise<MemoryEntry[]>
    add(kind: MemoryKind, content: string): Promise<MemoryEntry>
    remove(id: string): Promise<void>
  }

  profiles: {
    list(): Promise<Profile[]>
    add(name: string, color: string): Promise<Profile>
    activate(id: string): Promise<void>
  }

  settings: {
    get(): Promise<NovaSettings>
    set(patch: Partial<NovaSettings>): Promise<NovaSettings>
  }

  window: {
    minimize(): void
    maximize(): void
    close(): void
  }
}

/** Re-exported so both preload and renderer can `import type`. */
export type { AgentAction, ChatMessage }
