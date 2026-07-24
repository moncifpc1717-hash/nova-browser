/**
 * Nova shared domain types.
 *
 * This module is the single source of truth for the data shapes that cross the
 * process boundary between the Electron main process and the React renderer.
 * Both sides import from `@shared/types`, so a change here is enforced by the
 * TypeScript compiler on both ends — the contract can never silently drift.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Tabs & navigation
// ─────────────────────────────────────────────────────────────────────────────

export type TabLoadState = 'idle' | 'loading' | 'complete' | 'error'

/**
 * A single browser tab. `internalPage` is set when the tab is showing one of
 * Nova's own React pages (new tab, settings, …) rather than remote web content.
 */
export interface TabState {
  id: string
  title: string
  url: string
  favicon: string | null
  loadState: TabLoadState
  canGoBack: boolean
  canGoForward: boolean
  isActive: boolean
  isPinned: boolean
  isAgentControlled: boolean
  internalPage: InternalPage | null
  createdAt: number
}

export type InternalPage =
  | 'new-tab'
  | 'settings'
  | 'history'
  | 'bookmarks'
  | 'downloads'

/** A lightweight snapshot of the visible page, handed to the AI for context. */
export interface PageContext {
  tabId: string
  url: string
  title: string
  /** Cleaned, readable text extracted from the DOM (reader-mode style). */
  text: string
  /** Word count of the extracted text — used to decide chunking strategy. */
  wordCount: number
  selection: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Profiles, history, bookmarks, downloads
// ─────────────────────────────────────────────────────────────────────────────

export interface Profile {
  id: string
  name: string
  color: string
  avatar: string | null
  createdAt: number
}

export interface HistoryEntry {
  id: string
  url: string
  title: string
  favicon: string | null
  visitedAt: number
}

export interface Bookmark {
  id: string
  url: string
  title: string
  favicon: string | null
  folder: string
  createdAt: number
}

export type DownloadState = 'progressing' | 'completed' | 'cancelled' | 'interrupted'

export interface DownloadItem {
  id: string
  filename: string
  url: string
  savePath: string
  mimeType: string
  receivedBytes: number
  totalBytes: number
  state: DownloadState
  startedAt: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Password vault
// ─────────────────────────────────────────────────────────────────────────────

/** A stored credential. The password is encrypted at rest via Electron safeStorage. */
export interface VaultEntry {
  id: string
  origin: string
  username: string
  /** Base64 of the OS-encrypted password blob. Never the plaintext. */
  secret: string
  updatedAt: number
}

// ─────────────────────────────────────────────────────────────────────────────
// AI providers & chat
// ─────────────────────────────────────────────────────────────────────────────

export type ProviderId =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'grok'
  | 'deepseek'
  | 'ollama'

export interface ProviderConfig {
  id: ProviderId
  label: string
  /** Whether this provider requires an API key (Ollama/local do not). */
  requiresKey: boolean
  /** Default base URL; overridable for self-hosted / proxied endpoints. */
  baseUrl: string
  models: string[]
  /** Whether the user has supplied the credentials needed to use it. */
  configured: boolean
  /** The model currently selected for this provider. */
  activeModel: string
}

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  createdAt: number
  /** Present on assistant messages produced while streaming. */
  streaming?: boolean
  /** Optional trace of agent actions attached to an assistant turn. */
  actions?: AgentActionRecord[]
}

/** A normalized message shape sent to every provider adapter. */
export interface LlmMessage {
  role: Exclude<ChatRole, 'tool'>
  content: string
}

export interface LlmRequest {
  provider: ProviderId
  model: string
  messages: LlmMessage[]
  temperature?: number
  /** Upper bound on generated tokens; adapters map this to provider params. */
  maxTokens?: number
  /** When true the adapter must emit incremental deltas. */
  stream: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Autonomous agent
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The closed vocabulary of actions the browser agent may take. The LLM is
 * constrained to emit exactly one of these per step as strict JSON, which the
 * main process validates before touching the live page.
 */
export type AgentActionType =
  | 'navigate'
  | 'click'
  | 'type'
  | 'scroll'
  | 'select'
  | 'wait'
  | 'extract'
  | 'ask'
  | 'finish'

export interface AgentAction {
  type: AgentActionType
  /** For navigate. */
  url?: string
  /** For click/type/select — the numeric label of an interactive element. */
  target?: number
  /** For type/select. */
  value?: string
  /** For scroll: 'up' | 'down' | 'top' | 'bottom'. */
  direction?: 'up' | 'down' | 'top' | 'bottom'
  /** For wait — milliseconds. */
  ms?: number
  /** For ask/finish — the message shown to the user. */
  message?: string
  /** The agent's private rationale for this step (surfaced in the trace UI). */
  reasoning?: string
  /**
   * When true, Nova pauses and requires explicit user approval before
   * executing. The LLM is instructed to set this for logins, purchases,
   * submissions, and anything irreversible.
   */
  sensitive?: boolean
}

export type AgentActionStatus = 'pending' | 'awaiting-confirmation' | 'running' | 'done' | 'error' | 'rejected'

/** A single executed (or attempted) step in an agent run, for the trace UI. */
export interface AgentActionRecord {
  id: string
  action: AgentAction
  status: AgentActionStatus
  result?: string
  error?: string
  at: number
}

export type AgentRunStatus = 'idle' | 'planning' | 'acting' | 'paused' | 'done' | 'error'

export interface AgentRunState {
  id: string
  goal: string
  status: AgentRunStatus
  tabId: string | null
  steps: AgentActionRecord[]
  finalAnswer: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Omnibox intent classification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The omnibox is Nova's unified input. Before doing anything it classifies the
 * raw text into one of these intents so a URL opens a page, a question hits the
 * AI, and a task ("book me a hotel") launches the agent.
 */
export type OmniIntent = 'url' | 'search' | 'ask' | 'command'

export interface OmniClassification {
  intent: OmniIntent
  /** Normalized value: a full URL for `url`, or the cleaned query/goal text. */
  value: string
  confidence: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings & memory
// ─────────────────────────────────────────────────────────────────────────────

export interface NovaSettings {
  activeProvider: ProviderId
  theme: 'dark' | 'light' | 'system'
  language: string
  searchEngine: 'google' | 'bing' | 'duckduckgo'
  voiceEnabled: boolean
  wakeWord: string
  /** Require confirmation for every sensitive agent action. */
  confirmSensitiveActions: boolean
}

export type MemoryKind = 'fact' | 'habit' | 'style' | 'prompt' | 'task' | 'note'

export interface MemoryEntry {
  id: string
  kind: MemoryKind
  content: string
  createdAt: number
}
