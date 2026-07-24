/**
 * IPC channel registry.
 *
 * Every message that crosses the main↔renderer boundary is named here as a
 * string constant. Centralizing them prevents typos (a misspelled channel is a
 * silent no-op in Electron) and gives us one place to audit the full surface
 * area the renderer can reach. Channels are grouped by domain.
 *
 * Naming convention:
 *   `<domain>:<verb>`         — renderer → main request (invoke/handle)
 *   `<domain>:event:<name>`   — main → renderer push (send/on)
 */
export const IPC = {
  // Tab lifecycle & navigation ------------------------------------------------
  TAB_CREATE: 'tab:create',
  TAB_CLOSE: 'tab:close',
  TAB_ACTIVATE: 'tab:activate',
  TAB_NAVIGATE: 'tab:navigate',
  TAB_BACK: 'tab:back',
  TAB_FORWARD: 'tab:forward',
  TAB_RELOAD: 'tab:reload',
  TAB_REORDER: 'tab:reorder',
  TAB_PIN: 'tab:pin',
  TABS_GET: 'tab:get-all',
  TABS_CHANGED: 'tab:event:changed',

  // Layout: the main process owns where the WebContentsView is painted --------
  VIEW_SET_BOUNDS: 'view:set-bounds',

  // Omnibox -------------------------------------------------------------------
  OMNI_SUBMIT: 'omni:submit',
  OMNI_CLASSIFY: 'omni:classify',

  // Page context for the AI ---------------------------------------------------
  PAGE_GET_CONTEXT: 'page:get-context',

  // AI providers & chat -------------------------------------------------------
  AI_LIST_PROVIDERS: 'ai:list-providers',
  AI_SET_PROVIDER: 'ai:set-provider',
  AI_SET_KEY: 'ai:set-key',
  AI_SET_MODEL: 'ai:set-model',
  AI_CHAT: 'ai:chat',
  AI_CHAT_DELTA: 'ai:event:chat-delta',
  AI_CHAT_DONE: 'ai:event:chat-done',
  AI_CHAT_ERROR: 'ai:event:chat-error',
  AI_ABORT: 'ai:abort',

  // Autonomous agent ----------------------------------------------------------
  AGENT_RUN: 'agent:run',
  AGENT_CONFIRM: 'agent:confirm',
  AGENT_ABORT: 'agent:abort',
  AGENT_EVENT: 'agent:event:update',

  // Storage: history / bookmarks / downloads / vault / memory / settings ------
  HISTORY_LIST: 'history:list',
  HISTORY_DELETE: 'history:delete',
  HISTORY_CLEAR: 'history:clear',

  BOOKMARK_LIST: 'bookmark:list',
  BOOKMARK_ADD: 'bookmark:add',
  BOOKMARK_REMOVE: 'bookmark:remove',

  DOWNLOAD_LIST: 'download:list',
  DOWNLOAD_CHANGED: 'download:event:changed',
  DOWNLOAD_OPEN: 'download:open',

  VAULT_LIST: 'vault:list',
  VAULT_SAVE: 'vault:save',
  VAULT_REVEAL: 'vault:reveal',
  VAULT_REMOVE: 'vault:remove',

  MEMORY_LIST: 'memory:list',
  MEMORY_ADD: 'memory:add',
  MEMORY_REMOVE: 'memory:remove',

  PROFILE_LIST: 'profile:list',
  PROFILE_ADD: 'profile:add',
  PROFILE_ACTIVATE: 'profile:activate',

  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // Window controls -----------------------------------------------------------
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
