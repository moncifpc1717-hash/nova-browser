/**
 * Preload bridge.
 *
 * This is the only code that touches raw `ipcRenderer`. It implements the
 * `NovaApi` contract from `@shared/api` and exposes it as `window.nova` via
 * `contextBridge`, so the React app gets a clean, fully-typed, promise-based
 * client with zero Node/Electron surface leaking into the untrusted renderer.
 *
 * Every event subscription returns an unsubscribe function, so React effects
 * can clean up listeners on unmount without leaking.
 */
import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'
import type { NovaApi, ChatTurnRequest, Unsubscribe } from '@shared/api'
import type {
  AgentRunState,
  Bookmark,
  DownloadItem,
  MemoryKind,
  NovaSettings,
  ProviderId,
  TabState
} from '@shared/types'

/** Subscribe to a main→renderer channel, returning an unsubscribe fn. */
function on(channel: string, cb: (...args: never[]) => void): Unsubscribe {
  const listener = (_e: Electron.IpcRendererEvent, ...args: unknown[]) =>
    (cb as (...a: unknown[]) => void)(...args)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: NovaApi = {
  tabs: {
    create: (url) => ipcRenderer.invoke(IPC.TAB_CREATE, url),
    close: (id) => ipcRenderer.invoke(IPC.TAB_CLOSE, id),
    activate: (id) => ipcRenderer.invoke(IPC.TAB_ACTIVATE, id),
    navigate: (id, url) => ipcRenderer.invoke(IPC.TAB_NAVIGATE, id, url),
    back: (id) => ipcRenderer.invoke(IPC.TAB_BACK, id),
    forward: (id) => ipcRenderer.invoke(IPC.TAB_FORWARD, id),
    reload: (id) => ipcRenderer.invoke(IPC.TAB_RELOAD, id),
    reorder: (id, toIndex) => ipcRenderer.invoke(IPC.TAB_REORDER, id, toIndex),
    pin: (id, pinned) => ipcRenderer.invoke(IPC.TAB_PIN, id, pinned),
    getAll: () => ipcRenderer.invoke(IPC.TABS_GET),
    onChanged: (cb: (tabs: TabState[]) => void) => on(IPC.TABS_CHANGED, cb as never),
    setBounds: (bounds) => ipcRenderer.send(IPC.VIEW_SET_BOUNDS, bounds)
  },

  omni: {
    classify: (input) => ipcRenderer.invoke(IPC.OMNI_CLASSIFY, input),
    submit: (input) => ipcRenderer.invoke(IPC.OMNI_SUBMIT, input)
  },

  page: {
    getContext: (tabId) => ipcRenderer.invoke(IPC.PAGE_GET_CONTEXT, tabId)
  },

  ai: {
    listProviders: () => ipcRenderer.invoke(IPC.AI_LIST_PROVIDERS),
    setActiveProvider: (id: ProviderId) => ipcRenderer.invoke(IPC.AI_SET_PROVIDER, id),
    setKey: (id: ProviderId, key: string) => ipcRenderer.invoke(IPC.AI_SET_KEY, id, key),
    setModel: (id: ProviderId, model: string) => ipcRenderer.invoke(IPC.AI_SET_MODEL, id, model),
    chat: (req: ChatTurnRequest) => ipcRenderer.invoke(IPC.AI_CHAT, req),
    abort: (requestId: string) => ipcRenderer.invoke(IPC.AI_ABORT, requestId),
    onDelta: (cb) => on(IPC.AI_CHAT_DELTA, cb as never),
    onDone: (cb) => on(IPC.AI_CHAT_DONE, cb as never),
    onError: (cb) => on(IPC.AI_CHAT_ERROR, cb as never)
  },

  agent: {
    run: (goal, tabId) => ipcRenderer.invoke(IPC.AGENT_RUN, goal, tabId),
    confirm: (runId, actionId, approved) =>
      ipcRenderer.invoke(IPC.AGENT_CONFIRM, runId, actionId, approved),
    abort: (runId) => ipcRenderer.invoke(IPC.AGENT_ABORT, runId),
    onUpdate: (cb: (state: AgentRunState) => void) => on(IPC.AGENT_EVENT, cb as never)
  },

  history: {
    list: (query) => ipcRenderer.invoke(IPC.HISTORY_LIST, query),
    delete: (id) => ipcRenderer.invoke(IPC.HISTORY_DELETE, id),
    clear: () => ipcRenderer.invoke(IPC.HISTORY_CLEAR)
  },

  bookmarks: {
    list: () => ipcRenderer.invoke(IPC.BOOKMARK_LIST),
    add: (b: Omit<Bookmark, 'id' | 'createdAt'>) => ipcRenderer.invoke(IPC.BOOKMARK_ADD, b),
    remove: (id) => ipcRenderer.invoke(IPC.BOOKMARK_REMOVE, id)
  },

  downloads: {
    list: () => ipcRenderer.invoke(IPC.DOWNLOAD_LIST),
    open: (id) => ipcRenderer.invoke(IPC.DOWNLOAD_OPEN, id),
    onChanged: (cb: (items: DownloadItem[]) => void) => on(IPC.DOWNLOAD_CHANGED, cb as never)
  },

  vault: {
    list: () => ipcRenderer.invoke(IPC.VAULT_LIST),
    save: (origin, username, password) =>
      ipcRenderer.invoke(IPC.VAULT_SAVE, origin, username, password),
    reveal: (id) => ipcRenderer.invoke(IPC.VAULT_REVEAL, id),
    remove: (id) => ipcRenderer.invoke(IPC.VAULT_REMOVE, id)
  },

  memory: {
    list: (kind?: MemoryKind) => ipcRenderer.invoke(IPC.MEMORY_LIST, kind),
    add: (kind: MemoryKind, content: string) => ipcRenderer.invoke(IPC.MEMORY_ADD, kind, content),
    remove: (id) => ipcRenderer.invoke(IPC.MEMORY_REMOVE, id)
  },

  profiles: {
    list: () => ipcRenderer.invoke(IPC.PROFILE_LIST),
    add: (name, color) => ipcRenderer.invoke(IPC.PROFILE_ADD, name, color),
    activate: (id) => ipcRenderer.invoke(IPC.PROFILE_ACTIVATE, id)
  },

  settings: {
    get: () => ipcRenderer.invoke(IPC.SETTINGS_GET),
    set: (patch: Partial<NovaSettings>) => ipcRenderer.invoke(IPC.SETTINGS_SET, patch)
  },

  window: {
    minimize: () => ipcRenderer.send(IPC.WINDOW_MINIMIZE),
    maximize: () => ipcRenderer.send(IPC.WINDOW_MAXIMIZE),
    close: () => ipcRenderer.send(IPC.WINDOW_CLOSE)
  }
}

contextBridge.exposeInMainWorld('nova', api)
