/**
 * OllamaAdapter — targets a locally running Ollama server for fully offline,
 * private inference. Ollama streams newline-delimited JSON objects (not SSE),
 * so this adapter reads raw lines. No API key is required.
 */
import type { AdapterCallOptions, AdapterCredentials, ChatAdapter } from './types'
import { assertOk, readLines } from './sse'

export class OllamaAdapter implements ChatAdapter {
  constructor(private creds: AdapterCredentials) {}

  private body(opts: AdapterCallOptions, stream: boolean): string {
    return JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      stream,
      options: { temperature: opts.temperature ?? 0.7 }
    })
  }

  async stream(opts: AdapterCallOptions, onDelta: (delta: string) => void): Promise<string> {
    const res = await fetch(`${this.creds.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: this.body(opts, true),
      signal: opts.signal
    })
    await assertOk(res, 'Ollama')

    let full = ''
    for await (const line of readLines(res)) {
      if (!line.trim()) continue
      try {
        const json = JSON.parse(line)
        const delta: string = json.message?.content ?? ''
        if (delta) {
          full += delta
          onDelta(delta)
        }
      } catch {
        /* ignore malformed line */
      }
    }
    return full
  }

  async complete(opts: AdapterCallOptions): Promise<string> {
    const res = await fetch(`${this.creds.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: this.body(opts, false),
      signal: opts.signal
    })
    await assertOk(res, 'Ollama')
    const json = (await res.json()) as { message?: { content?: string } }
    return json.message?.content ?? ''
  }
}
