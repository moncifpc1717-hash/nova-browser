/**
 * Controller — the imperative glue between the React UI and `window.nova`.
 *
 * Components stay declarative; all side-effecting orchestration (streaming a
 * chat turn, launching the agent, routing the omnibox) lives here. It reads and
 * writes the Zustand store directly so any component re-renders from a single
 * source of truth.
 */
import type { ChatMessage, LlmMessage } from '@shared/types'
import { classifyOmni } from '@shared/omnibox'
import { useStore } from '../state/store'

let uid = 0
const nextId = (p: string) => `${p}_${Date.now().toString(36)}_${uid++}`

/** One-time subscription to all main→renderer push channels. */
export function bindBridgeEvents(): () => void {
  const unsubs: Array<() => void> = [
    window.nova.tabs.onChanged((tabs) => useStore.getState().setTabs(tabs)),
    window.nova.downloads.onChanged((items) => useStore.getState().setDownloads(items)),
    window.nova.agent.onUpdate((state) => useStore.getState().setAgentRun(state))
  ]
  return () => unsubs.forEach((u) => u())
}

/** Load initial state from the main process. */
export async function bootstrap(): Promise<void> {
  const s = useStore.getState()
  const [tabs, providers, settings, downloads] = await Promise.all([
    window.nova.tabs.getAll(),
    window.nova.ai.listProviders(),
    window.nova.settings.get(),
    window.nova.downloads.list()
  ])
  s.setTabs(tabs)
  s.setProviders(providers)
  s.setSettings(settings)
  s.setDownloads(downloads)
}

/**
 * Send a chat turn to the active provider and stream the reply into the store.
 * Correlates streaming deltas by a per-request id and tears down its own
 * listeners when the turn completes.
 */
export async function sendChat(text: string, includePageContext: boolean): Promise<void> {
  const s = useStore.getState()
  const requestId = nextId('req')

  const userMsg: ChatMessage = {
    id: nextId('u'),
    role: 'user',
    content: text,
    createdAt: Date.now()
  }
  const assistantId = nextId('a')
  const assistantMsg: ChatMessage = {
    id: assistantId,
    role: 'assistant',
    content: '',
    createdAt: Date.now(),
    streaming: true
  }
  s.addMessage(userMsg)
  s.addMessage(assistantMsg)
  s.setStreaming(true)
  s.setActiveRequestId(requestId)

  // Build the LLM transcript from the existing conversation (excluding the
  // empty assistant placeholder we just added).
  const history: LlmMessage[] = useStore
    .getState()
    .messages.filter((m) => m.id !== assistantId && (m.role === 'user' || m.role === 'assistant'))
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  const cleanup: Array<() => void> = []
  const done = () => {
    cleanup.forEach((c) => c())
    useStore.getState().setStreaming(false)
    useStore.getState().setActiveRequestId(null)
  }

  cleanup.push(
    window.nova.ai.onDelta((rid, delta) => {
      if (rid === requestId) useStore.getState().appendToMessage(assistantId, delta)
    })
  )
  cleanup.push(
    window.nova.ai.onDone((rid, full) => {
      if (rid !== requestId) return
      useStore.getState().finalizeMessage(assistantId, full || undefined)
      done()
    })
  )
  cleanup.push(
    window.nova.ai.onError((rid, error) => {
      if (rid !== requestId) return
      useStore.getState().setMessageError(assistantId, error)
      done()
    })
  )

  const activeTabId = useStore.getState().activeTabId
  await window.nova.ai.chat({
    requestId,
    messages: history,
    includePageContext,
    tabId: activeTabId
  })
}

/** Abort the in-flight chat generation, aborting the backend stream too. */
export function stopChat(): void {
  const rid = useStore.getState().activeRequestId
  if (rid) void window.nova.ai.abort(rid)
  useStore.getState().setStreaming(false)
  useStore.getState().setActiveRequestId(null)
}

/** Launch the autonomous agent for a natural-language goal. */
export async function runAgent(goal: string): Promise<void> {
  const activeTabId = useStore.getState().activeTabId
  useStore.getState().setSidebar(true)
  await window.nova.agent.run(goal, activeTabId)
}

/** Approve or reject the agent's currently-parked sensitive action. */
export function confirmAgent(approved: boolean): void {
  const run = useStore.getState().agentRun
  if (!run) return
  const pending = run.steps.find((st) => st.status === 'awaiting-confirmation')
  void window.nova.agent.confirm(run.id, pending?.id ?? '', approved)
}

/**
 * Route omnibox input. URLs and searches are handled in the main process (they
 * drive the active tab); questions open the AI panel; commands launch the
 * agent. Returns the resolved intent so the caller can give visual feedback.
 */
export async function submitOmni(input: string): Promise<void> {
  const c = classifyOmni(input)
  const s = useStore.getState()
  switch (c.intent) {
    case 'url':
    case 'search':
      await window.nova.omni.submit(input)
      break
    case 'ask':
      s.setSidebar(true)
      await sendChat(c.value, true)
      break
    case 'command':
      await runAgent(c.value)
      break
  }
}
