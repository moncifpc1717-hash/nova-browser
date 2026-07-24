/**
 * The renderer's single Zustand store.
 *
 * It mirrors main-process state that the UI needs to react to (tabs, downloads,
 * agent runs) and owns purely-UI state (which panel is open, chat transcript,
 * omnibox draft). Main-process events flow in through `bindBridgeEvents`, which
 * subscribes to every `window.nova.*.on*` channel exactly once at app start.
 */
import { create } from 'zustand'
import type {
  AgentRunState,
  ChatMessage,
  DownloadItem,
  NovaSettings,
  ProviderConfig,
  TabState
} from '@shared/types'

export type PanelView =
  | { kind: 'web' } // showing a live web tab
  | { kind: 'internal'; page: TabState['internalPage'] }

interface NovaStore {
  // Tabs ----------------------------------------------------------------------
  tabs: TabState[]
  activeTabId: string | null
  setTabs: (tabs: TabState[]) => void

  // AI sidebar ----------------------------------------------------------------
  sidebarOpen: boolean
  toggleSidebar: () => void
  setSidebar: (open: boolean) => void

  messages: ChatMessage[]
  addMessage: (m: ChatMessage) => void
  appendToMessage: (id: string, delta: string) => void
  finalizeMessage: (id: string, full?: string) => void
  setMessageError: (id: string, error: string) => void
  clearMessages: () => void

  isStreaming: boolean
  setStreaming: (v: boolean) => void
  /** The in-flight chat request id, so the UI can abort the backend stream. */
  activeRequestId: string | null
  setActiveRequestId: (id: string | null) => void

  // Agent ---------------------------------------------------------------------
  agentRun: AgentRunState | null
  setAgentRun: (r: AgentRunState | null) => void

  // Downloads -----------------------------------------------------------------
  downloads: DownloadItem[]
  setDownloads: (d: DownloadItem[]) => void

  // Providers & settings ------------------------------------------------------
  providers: ProviderConfig[]
  setProviders: (p: ProviderConfig[]) => void
  settings: NovaSettings | null
  setSettings: (s: NovaSettings) => void

  // Derived helpers -----------------------------------------------------------
  activeTab: () => TabState | null
}

export const useStore = create<NovaStore>((set, get) => ({
  tabs: [],
  activeTabId: null,
  setTabs: (tabs) =>
    set({ tabs, activeTabId: tabs.find((t) => t.isActive)?.id ?? null }),

  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebar: (open) => set({ sidebarOpen: open }),

  messages: [],
  addMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
  appendToMessage: (id, delta) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + delta, streaming: true } : m
      )
    })),
  finalizeMessage: (id, full) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, content: full ?? m.content, streaming: false } : m
      )
    })),
  setMessageError: (id, error) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, content: `⚠️ ${error}`, streaming: false } : m
      )
    })),
  clearMessages: () => set({ messages: [] }),

  isStreaming: false,
  setStreaming: (v) => set({ isStreaming: v }),
  activeRequestId: null,
  setActiveRequestId: (id) => set({ activeRequestId: id }),

  agentRun: null,
  setAgentRun: (r) => set({ agentRun: r }),

  downloads: [],
  setDownloads: (d) => set({ downloads: d }),

  providers: [],
  setProviders: (p) => set({ providers: p }),
  settings: null,
  setSettings: (s) => set({ settings: s }),

  activeTab: () => {
    const { tabs, activeTabId } = get()
    return tabs.find((t) => t.id === activeTabId) ?? null
  }
}))
