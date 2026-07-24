/**
 * GeminiAdapter — targets Google's Generative Language API. Gemini diverges
 * most from the others: roles are `user`/`model`, messages are `contents` with
 * `parts`, the system prompt is `systemInstruction`, the key rides as a query
 * param, and streaming uses `streamGenerateContent?alt=sse`.
 */
import type { LlmMessage } from '@shared/types'
import type { AdapterCallOptions, AdapterCredentials, ChatAdapter } from './types'
import { assertOk, readSse } from './sse'

export class GeminiAdapter implements ChatAdapter {
  constructor(private creds: AdapterCredentials) {}

  private buildPayload(opts: AdapterCallOptions): Record<string, unknown> {
    const system = opts.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n')
    const contents = opts.messages
      .filter((m) => m.role !== 'system')
      .map((m: LlmMessage) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }))
    return {
      contents,
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      generationConfig: {
        temperature: opts.temperature ?? 0.7,
        maxOutputTokens: opts.maxTokens ?? 4096
      }
    }
  }

  private url(model: string, method: string, sse: boolean): string {
    const key = this.creds.apiKey ?? ''
    const suffix = sse ? '&alt=sse' : ''
    return `${this.creds.baseUrl}/models/${model}:${method}?key=${key}${suffix}`
  }

  async stream(opts: AdapterCallOptions, onDelta: (delta: string) => void): Promise<string> {
    const res = await fetch(this.url(opts.model, 'streamGenerateContent', true), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.buildPayload(opts)),
      signal: opts.signal
    })
    await assertOk(res, 'Gemini')

    let full = ''
    for await (const payload of readSse(res)) {
      try {
        const json = JSON.parse(payload)
        const delta: string =
          json.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''
        if (delta) {
          full += delta
          onDelta(delta)
        }
      } catch {
        /* ignore partial fragments */
      }
    }
    return full
  }

  async complete(opts: AdapterCallOptions): Promise<string> {
    const res = await fetch(this.url(opts.model, 'generateContent', false), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.buildPayload(opts)),
      signal: opts.signal
    })
    await assertOk(res, 'Gemini')
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    return (
      json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
    )
  }
}
