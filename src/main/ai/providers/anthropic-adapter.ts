/**
 * AnthropicAdapter — targets the Claude Messages API. Two shape differences
 * from OpenAI are handled here: the system prompt is a top-level field (not a
 * message), and streaming deltas arrive as `content_block_delta` events rather
 * than `choices[].delta`.
 */
import type { LlmMessage } from '@shared/types'
import type { AdapterCallOptions, AdapterCredentials, ChatAdapter } from './types'
import { assertOk, readSse } from './sse'

const ANTHROPIC_VERSION = '2023-06-01'

export class AnthropicAdapter implements ChatAdapter {
  constructor(private creds: AdapterCredentials) {}

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.creds.apiKey ?? '',
      'anthropic-version': ANTHROPIC_VERSION,
      // Allows browser-origin requests from Electron's renderer-less fetch.
      'anthropic-dangerous-direct-browser-access': 'true'
    }
  }

  /** Split Nova's flat message list into (system, turns) as Claude expects. */
  private split(messages: LlmMessage[]): { system: string; turns: LlmMessage[] } {
    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n')
    const turns = messages.filter((m) => m.role !== 'system')
    return { system, turns }
  }

  private body(opts: AdapterCallOptions, stream: boolean): string {
    const { system, turns } = this.split(opts.messages)
    return JSON.stringify({
      model: opts.model,
      system: system || undefined,
      messages: turns.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0.7,
      stream
    })
  }

  async stream(opts: AdapterCallOptions, onDelta: (delta: string) => void): Promise<string> {
    const res = await fetch(`${this.creds.baseUrl}/messages`, {
      method: 'POST',
      headers: this.headers(),
      body: this.body(opts, true),
      signal: opts.signal
    })
    await assertOk(res, 'Claude')

    let full = ''
    for await (const payload of readSse(res)) {
      try {
        const json = JSON.parse(payload)
        if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
          const delta: string = json.delta.text ?? ''
          if (delta) {
            full += delta
            onDelta(delta)
          }
        }
      } catch {
        /* ignore non-JSON event lines */
      }
    }
    return full
  }

  async complete(opts: AdapterCallOptions): Promise<string> {
    const res = await fetch(`${this.creds.baseUrl}/messages`, {
      method: 'POST',
      headers: this.headers(),
      body: this.body(opts, false),
      signal: opts.signal
    })
    await assertOk(res, 'Claude')
    const json = (await res.json()) as { content?: Array<{ text?: string }> }
    return json.content?.map((c) => c.text ?? '').join('') ?? ''
  }
}
