/**
 * ChatService — orchestrates conversational turns for the AI sidebar.
 *
 * It assembles the system prompt (persona + user memory + optional live page
 * context), streams the completion from whichever provider is active, and
 * relays deltas back to the renderer over IPC. In-flight requests are tracked
 * by id so the user can abort a runaway generation.
 */
import type { WebContents } from 'electron'
import type { LlmMessage, PageContext } from '@shared/types'
import { IPC } from '@shared/ipc'
import type { ProviderRegistry } from './provider-registry'
import type { MemoryService } from '../services/memory-service'
import { NOVA_PERSONA, pageContextBlock } from './prompts'

export interface ChatRunArgs {
  requestId: string
  messages: LlmMessage[]
  pageContext: PageContext | null
}

export class ChatService {
  private inflight = new Map<string, AbortController>()

  constructor(
    private registry: ProviderRegistry,
    private memory: MemoryService
  ) {}

  /** Assemble the full system prompt from persona, memory, and page context. */
  private buildSystem(pageContext: PageContext | null): string {
    const parts = [NOVA_PERSONA]
    const mem = this.memory.buildContextBlock()
    if (mem) parts.push(mem)
    const page = pageContextBlock(pageContext)
    if (page) parts.push(page)
    return parts.join('\n\n---\n\n')
  }

  /**
   * Run a streaming chat turn, pushing deltas to the given renderer. Resolves
   * when the stream finishes; emits an error event (not a throw) on failure so
   * the UI can render it inline.
   */
  async run(sender: WebContents, args: ChatRunArgs): Promise<void> {
    const { requestId, messages, pageContext } = args
    const controller = new AbortController()
    this.inflight.set(requestId, controller)

    const send = (channel: string, ...payload: unknown[]) => {
      if (!sender.isDestroyed()) sender.send(channel, ...payload)
    }

    try {
      const { adapter, model } = this.registry.adapterFor()
      const system: LlmMessage = { role: 'system', content: this.buildSystem(pageContext) }
      const full = await adapter.stream(
        {
          model,
          messages: [system, ...messages],
          signal: controller.signal
        },
        (delta) => send(IPC.AI_CHAT_DELTA, requestId, delta)
      )
      send(IPC.AI_CHAT_DONE, requestId, full)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      // A user-initiated abort is expected, not an error to surface loudly.
      if (controller.signal.aborted) {
        send(IPC.AI_CHAT_DONE, requestId, '')
      } else {
        send(IPC.AI_CHAT_ERROR, requestId, message)
      }
    } finally {
      this.inflight.delete(requestId)
    }
  }

  abort(requestId: string): void {
    this.inflight.get(requestId)?.abort()
    this.inflight.delete(requestId)
  }
}
