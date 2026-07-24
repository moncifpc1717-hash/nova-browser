/**
 * AppContext — Nova's composition root.
 *
 * Following Clean Architecture, dependencies flow inward and are wired exactly
 * once here. Services never `new` their own collaborators; they receive them.
 * That keeps every unit independently testable and makes the whole dependency
 * graph legible in a single file. `create()` is the only place that knows how
 * the pieces fit together.
 */
import { BaseWindow, session, type WebContents } from 'electron'
import type { DownloadItem, AgentRunState } from '@shared/types'
import { IPC } from '@shared/ipc'
import { Database } from '../services/database'
import { SettingsService } from '../services/settings-service'
import { HistoryService } from '../services/history-service'
import { BookmarkService } from '../services/bookmark-service'
import { VaultService } from '../services/vault-service'
import { MemoryService } from '../services/memory-service'
import { ProfileService } from '../services/profile-service'
import { PageContextService } from '../services/page-context-service'
import { ProviderRegistry } from '../ai/provider-registry'
import { ChatService } from '../ai/chat-service'
import { AgentRunner } from '../ai/agent/agent-runner'
import { TabManager } from './tab-manager'
import { DownloadManager } from './download-manager'

export interface AppContext {
  db: Database
  window: BaseWindow
  chrome: WebContents
  settings: SettingsService
  history: HistoryService
  bookmarks: BookmarkService
  vault: VaultService
  memory: MemoryService
  profiles: ProfileService
  registry: ProviderRegistry
  chat: ChatService
  agent: AgentRunner
  tabs: TabManager
  downloads: DownloadManager
  pageContext: PageContextService
}

export interface CreateContextArgs {
  window: BaseWindow
  chrome: WebContents
  rendererUrl: string
}

/** Build and wire the entire main-process service graph. */
export async function createAppContext(args: CreateContextArgs): Promise<AppContext> {
  const { window, chrome, rendererUrl } = args

  // 1. Persistence.
  const db = new Database()
  await db.init()

  // 2. Storage services (pure, depend only on the db).
  const settings = new SettingsService(db)
  const history = new HistoryService(db)
  const bookmarks = new BookmarkService(db)
  const vault = new VaultService(db)
  const memory = new MemoryService(db)
  const profiles = new ProfileService(db)

  // 3. AI layer.
  const registry = new ProviderRegistry(db, settings)
  const chat = new ChatService(registry, memory)

  // 4. Chromium tab layer (implements PageBridge for the agent).
  const tabs = new TabManager(window, chrome, history, profiles, rendererUrl)
  const pageContext = new PageContextService(tabs)

  // 5. Autonomous agent — depends on the tab bridge + AI + settings, and emits
  //    run state to the chrome renderer.
  const agent = new AgentRunner(tabs, registry, settings, (state: AgentRunState) => {
    if (!chrome.isDestroyed()) chrome.send(IPC.AGENT_EVENT, state)
  })

  // 6. Downloads across all profile sessions.
  const downloads = new DownloadManager((items: DownloadItem[]) => {
    if (!chrome.isDestroyed()) chrome.send(IPC.DOWNLOAD_CHANGED, items)
  })
  downloads.attachDefault()
  downloads.attach(session.fromPartition(profiles.activePartition()))

  return {
    db,
    window,
    chrome,
    settings,
    history,
    bookmarks,
    vault,
    memory,
    profiles,
    registry,
    chat,
    agent,
    tabs,
    downloads,
    pageContext
  }
}
