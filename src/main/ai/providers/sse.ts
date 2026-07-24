/**
 * A minimal Server-Sent-Events reader over `fetch`'s streaming body.
 *
 * All three streaming API families Nova targets (OpenAI-style, Anthropic, and
 * Ollama's line-delimited JSON) send incremental chunks over a single HTTP
 * response. This helper turns the raw byte stream into an async iterator of
 * text lines so each adapter can parse its own event shape without re-writing
 * buffering logic.
 */

/** Yield decoded text lines from a fetch Response body as they arrive. */
export async function* readLines(res: Response): AsyncGenerator<string> {
  if (!res.body) throw new Error('Response has no readable body')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let nl: number
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).replace(/\r$/, '')
        buffer = buffer.slice(nl + 1)
        yield line
      }
    }
    if (buffer.trim()) yield buffer
  } finally {
    reader.releaseLock()
  }
}

/**
 * Iterate `data:` payloads from an SSE stream (OpenAI/Anthropic style),
 * stopping on the sentinel `[DONE]`. Non-data lines are ignored.
 */
export async function* readSse(res: Response): AsyncGenerator<string> {
  for await (const line of readLines(res)) {
    if (!line.startsWith('data:')) continue
    const payload = line.slice(5).trim()
    if (payload === '[DONE]') return
    if (payload) yield payload
  }
}

/** Raise a descriptive error for a non-2xx response, including the body text. */
export async function assertOk(res: Response, provider: string): Promise<void> {
  if (res.ok) return
  let detail = ''
  try {
    detail = await res.text()
  } catch {
    /* ignore */
  }
  const snippet = detail.slice(0, 500)
  throw new Error(`${provider} request failed (${res.status} ${res.statusText}): ${snippet}`)
}
