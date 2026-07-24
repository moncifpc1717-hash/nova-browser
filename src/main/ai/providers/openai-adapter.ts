/**
 * OpenAIAdapter — targets the OpenAI Chat Completions API and every provider
 * that mirrors it (xAI Grok, DeepSeek). The only differences between those
 * services are the base URL and API key, both injected via credentials, so a
 * single adapter serves all three.
 */
import type { AdapterCallOptions, AdapterCredentials, ChatAdapter } from './types'
import { assertOk, readSse } from './sse'

export class OpenAIAdapter implements ChatAdapter {
  constructor(private creds: AdapterCredentials, private label: string) {}

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.creds.apiKey) h.Authorization = `Bearer ${this.creds.apiKey}`
    return h
  }

  private body(opts: AdapterCallOptions, stream: boolean): string {
    return JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens,
      stream
    })
  }

  async stream(opts: AdapterCallOptions, onDelta: (delta: string) => void): Promise<string> {
    const res = await fetch(`${this.creds.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: this.body(opts, true),
      signal: opts.signal
    })
    await assertOk(res, this.label)

    let full = ''
    for await (const payload of readSse(res)) {
      try {
        const json = JSON.parse(payload)
        const delta: string = json.choices?.[0]?.delta?.content ?? ''
        if (delta) {
          full += delta
          onDelta(delta)
        }
      } catch {
        // Ignore keep-alive / partial fragments that aren't valid JSON yet.
      }
    }
    return full
  }

  async complete(opts: AdapterCallOptions): Promise<string> {
    const res = await fetch(`${this.creds.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: this.body(opts, false),
      signal: opts.signal
    })
    await assertOk(res, this.label)
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    return json.choices?.[0]?.message?.content ?? ''
  }
}
