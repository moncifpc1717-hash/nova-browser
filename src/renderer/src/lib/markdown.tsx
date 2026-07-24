/**
 * A tiny, dependency-free Markdown renderer for chat bubbles.
 *
 * We intentionally avoid a heavyweight Markdown library: the assistant output
 * we render is a known, narrow subset (paragraphs, bold, inline code, fenced
 * code, lists, links, headings). This keeps the bundle lean and the render
 * path fast for streaming text. Output is escaped first, so it is safe to set
 * as innerHTML.
 */
import { useMemo } from 'react'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function inline(s: string): string {
  return s
    .replace(/`([^`]+)`/g, (_m, c) => `<code>${c}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    )
}

/** Convert a Markdown string to an HTML string covering our supported subset. */
export function renderMarkdown(src: string): string {
  const lines = src.split('\n')
  const html: string[] = []
  let inCode = false
  let codeBuf: string[] = []
  let listBuf: string[] = []
  let ordered = false

  const flushList = () => {
    if (listBuf.length) {
      const tag = ordered ? 'ol' : 'ul'
      html.push(`<${tag}>${listBuf.join('')}</${tag}>`)
      listBuf = []
    }
  }

  for (const line of lines) {
    const fence = line.trim().startsWith('```')
    if (fence) {
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`)
        codeBuf = []
        inCode = false
      } else {
        flushList()
        inCode = true
      }
      continue
    }
    if (inCode) {
      codeBuf.push(line)
      continue
    }

    const h = /^(#{1,3})\s+(.*)$/.exec(line)
    if (h) {
      flushList()
      const level = h[1].length
      html.push(`<h${level}>${inline(escapeHtml(h[2]))}</h${level}>`)
      continue
    }

    const ol = /^\s*\d+\.\s+(.*)$/.exec(line)
    const ul = /^\s*[-*]\s+(.*)$/.exec(line)
    if (ol || ul) {
      ordered = !!ol
      const content = (ol ?? ul)![1]
      listBuf.push(`<li>${inline(escapeHtml(content))}</li>`)
      continue
    }

    flushList()
    if (line.trim() === '') continue
    html.push(`<p>${inline(escapeHtml(line))}</p>`)
  }
  if (inCode) html.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`)
  flushList()
  return html.join('')
}

export function Markdown({ text }: { text: string }): JSX.Element {
  const html = useMemo(() => renderMarkdown(text), [text])
  return <div className="md" dangerouslySetInnerHTML={{ __html: html }} />
}
