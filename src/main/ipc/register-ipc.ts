/**
 * register-ipc — the single place where every renderer-callable channel is
 * bound to its handler. Grouping all `ipcMain.handle` / `.on` registrations
 * here (rather than scattering them across services) makes the trust boundary
 * auditable: this file is the complete list of everything the UI can ask the
 * privileged main process to do.
 *
 * Handlers are thin: they validate/relay and delegate to services. Business
 * logic lives in the services, not here.
 */
import { ipcMain, type WebContents } from 'electron'
import { IPC } from '@shared/ipc'
import type { MemoryKind, NovaSettings, ProviderId, Bookmark } from '@shared/types'
import { classifyOmni, searchUrl } from '@shared/omnibox'
import type { AppContext } from '../core/app-context'

export function registerIpc(ctx: AppContext): void {
  const {
    tabs,
    chat,
    agent,
    registry,
    history,
    bookmarks,
    downloads,
    vault,
    memory,
    profiles,
    settings,
    pageContext,
    window
  } = ctx

  // Thin wrapper so each registration reads as one line. Args are loosely typed
  // here (the renderer is the untrusted caller); services enforce real types.
  const handle = (
    channel: string,
    fn: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => unknown
  ) => ipcMain.handle(channel, fn)

  // ── Tabs ────────────────────────────────────────────────────────────────
  handle(IPC.TAB_CREATE, (_e, url?: string) => tabs.create(url))
  handle(IPC.TAB_CLOSE, (_e, id: string) => tabs.close(id))
  handle(IPC.TAB_ACTIVATE, (_e, id: string) => tabs.activate(id))
  handle(IPC.TAB_NAVIGATE, (_e, id: string, url: string) => tabs.navigate(id, url))
  handle(IPC.TAB_BACK, (_e, id: string) => tabs.back(id))
  handle(IPC.TAB_FORWARD, (_e, id: string) => tabs.forward(id))
  handle(IPC.TAB_RELOAD, (_e, id: string) => tabs.reload(id))
  handle(IPC.TAB_REORDER, (_e, id: string, toIndex: number) => tabs.reorder(id, toIndex))
  handle(IPC.TAB_PIN, (_e, id: string, pinned: boolean) => tabs.pin(id, pinned))
  handle(IPC.TABS_GET, () => tabs.getAll())
  ipcMain.on(IPC.VIEW_SET_BOUNDS, (_e, bounds) => tabs.setBounds(bounds))

  // ── Omnibox ──────────────────────────────────────────────────────────────
  handle(IPC.OMNI_CLASSIFY, (_e, input: string) => classifyOmni(input))
  handle(IPC.OMNI_SUBMIT, (_e, input: string) => {
    const c = classifyOmni(input)
    const active = tabs.getAll().find((t) => t.isActive)
    switch (c.intent) {
      case 'url':
        if (active) return tabs.navigate(active.id, c.value)
        tabs.create(c.value)
        return
      case 'search': {
        const url = searchUrl(c.value, settings.get().searchEngine)
        if (active) return tabs.navigate(active.id, url)
        tabs.create(url)
        return
      }
      // 'ask' and 'command' are handled in the renderer (they open the AI panel
      // / launch the agent); submit only covers direct navigation intents.
      default:
        return
    }
  })

  // ── Page context ───────────────────────────────────────────────────────────
  handle(IPC.PAGE_GET_CONTEXT, (_e, tabId: string) => pageContext.getContext(tabId))

  // ── AI providers & chat ──────────────────────────────────────────────────
  handle(IPC.AI_LIST_PROVIDERS, () => registry.list())
  handle(IPC.AI_SET_PROVIDER, (_e, id: ProviderId) => registry.setActiveProvider(id))
  handle(IPC.AI_SET_KEY, (_e, id: ProviderId, key: string) => registry.setKey(id, key))
  handle(IPC.AI_SET_MODEL, (_e, id: ProviderId, model: string) => registry.setModel(id, model))
  handle(IPC.AI_ABORT, (_e, requestId: string) => chat.abort(requestId))
  handle(
    IPC.AI_CHAT,
    async (
      event,
      req: {
        requestId: string
        messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
        includePageContext: boolean
        tabId: string | null
      }
    ) => {
      const pc = req.includePageContext && req.tabId ? await pageContext.getContext(req.tabId) : null
      // Fire-and-forget; deltas stream back over dedicated event channels.
      void chat.run(event.sender as WebContents, {
        requestId: req.requestId,
        messages: req.messages,
        pageContext: pc
      })
    }
  )

  // ── Autonomous agent ───────────────────────────────────────────────────────
  handle(IPC.AGENT_RUN, (_e, goal: string, tabId: string | null) => agent.run(goal, tabId))
  handle(IPC.AGENT_CONFIRM, (_e, runId: string, actionId: string, approved: boolean) =>
    agent.confirm(runId, actionId, approved)
  )
  handle(IPC.AGENT_ABORT, (_e, runId: string) => agent.abort(runId))

  // ── History ──────────────────────────────────────────────────────────────
  handle(IPC.HISTORY_LIST, (_e, query?: string) => history.list(query))
  handle(IPC.HISTORY_DELETE, (_e, id: string) => history.delete(id))
  handle(IPC.HISTORY_CLEAR, () => history.clear())

  // ── Bookmarks ──────────────────────────────────────────────────────────────
  handle(IPC.BOOKMARK_LIST, () => bookmarks.list())
  handle(IPC.BOOKMARK_ADD, (_e, b: Omit<Bookmark, 'id' | 'createdAt'>) => bookmarks.add(b))
  handle(IPC.BOOKMARK_REMOVE, (_e, id: string) => bookmarks.remove(id))

  // ── Downloads ──────────────────────────────────────────────────────────────
  handle(IPC.DOWNLOAD_LIST, () => downloads.list())
  handle(IPC.DOWNLOAD_OPEN, (_e, id: string) => downloads.open(id))

  // ── Vault ────────────────────────────────────────────────────────────────
  handle(IPC.VAULT_LIST, () => vault.list())
  handle(IPC.VAULT_SAVE, (_e, origin: string, username: string, password: string) =>
    vault.save(origin, username, password)
  )
  handle(IPC.VAULT_REVEAL, (_e, id: string) => vault.reveal(id))
  handle(IPC.VAULT_REMOVE, (_e, id: string) => vault.remove(id))

  // ── Memory ───────────────────────────────────────────────────────────────
  handle(IPC.MEMORY_LIST, (_e, kind?: MemoryKind) => memory.list(kind))
  handle(IPC.MEMORY_ADD, (_e, kind: MemoryKind, content: string) => memory.add(kind, content))
  handle(IPC.MEMORY_REMOVE, (_e, id: string) => memory.remove(id))

  // ── Profiles ─────────────────────────────────────────────────────────────
  handle(IPC.PROFILE_LIST, () => profiles.list())
  handle(IPC.PROFILE_ADD, (_e, name: string, color: string) => profiles.add(name, color))
  handle(IPC.PROFILE_ACTIVATE, (_e, id: string) => profiles.activate(id))

  // ── Settings ─────────────────────────────────────────────────────────────
  handle(IPC.SETTINGS_GET, () => settings.get())
  handle(IPC.SETTINGS_SET, (_e, patch: Partial<NovaSettings>) => settings.set(patch))

  // ── Window controls ──────────────────────────────────────────────────────
  ipcMain.on(IPC.WINDOW_MINIMIZE, () => window.minimize())
  ipcMain.on(IPC.WINDOW_MAXIMIZE, () =>
    window.isMaximized() ? window.unmaximize() : window.maximize()
  )
  ipcMain.on(IPC.WINDOW_CLOSE, () => window.close())
}
