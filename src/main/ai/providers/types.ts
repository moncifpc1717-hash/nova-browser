/**
 * Provider adapter contract.
 *
 * Every AI backend Nova supports — OpenAI, Claude, Gemini, Grok, DeepSeek,
 * Ollama — is normalized behind this one interface. The rest of the app (chat
 * service, agent runner) speaks only `ChatAdapter`, so switching providers is a
 * matter of picking a different implementation; no caller changes.
 */
import type { LlmMessage } from '@shared/types'

export interface AdapterCallOptions {
  model: string
  messages: LlmMessage[]
  temperature?: number
  maxTokens?: number
  /** Aborts the in-flight HTTP request when the user cancels. */
  signal?: AbortSignal
}

export interface ChatAdapter {
  /**
   * Stream a completion. Implementations invoke `onDelta` with each text chunk
   * as it arrives and resolve with the fully concatenated string. Errors reject.
   */
  stream(opts: AdapterCallOptions, onDelta: (delta: string) => void): Promise<string>

  /** Non-streaming convenience used by the agent for single-shot JSON planning. */
  complete(opts: AdapterCallOptions): Promise<string>
}

/** Runtime credentials/config resolved for a given provider at call time. */
export interface AdapterCredentials {
  apiKey: string | null
  baseUrl: string
}
