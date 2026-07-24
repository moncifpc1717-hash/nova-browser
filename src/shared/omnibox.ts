/**
 * Omnibox intent heuristics.
 *
 * The omnibox accepts anything the user types and must instantly decide what
 * they meant: open a site, run a web search, ask the AI a question, or hand a
 * task to the autonomous agent. A fast local heuristic runs first (zero latency,
 * no tokens); the LLM classifier is only consulted for genuinely ambiguous
 * input. This function is that heuristic and is deliberately dependency-free so
 * it can run in either process.
 */
import type { OmniClassification } from './types'

const COMMAND_VERBS = [
  'open', 'go to', 'navigate', 'search', 'find', 'compare', 'fill', 'login',
  'log in', 'sign in', 'book', 'buy', 'order', 'add to cart', 'checkout',
  'summarize', 'summarise', 'translate', 'explain', 'watch', 'read', 'reply',
  'organize', 'organise', 'download', 'upload', 'click', 'scroll', 'create',
  'generate', 'draft', 'write', 'send', 'schedule', 'extract'
]

const QUESTION_STARTS = [
  'what', 'why', 'how', 'when', 'where', 'who', 'which', 'is', 'are', 'can',
  'could', 'should', 'do', 'does', 'did', 'will', 'would'
]

const KNOWN_TLD =
  /\.(com|org|net|io|ai|dev|co|edu|gov|app|xyz|me|tv|news|so|gg|to|uk|de|fr|jp|cn|ru|br|in|ca|au|nl|es|it)(\/|$|\?|#|:)/i

/** True when the string looks like a bare host or full URL. */
function looksLikeUrl(input: string): boolean {
  const s = input.trim()
  if (/\s/.test(s)) return false // URLs never contain spaces
  if (/^https?:\/\//i.test(s)) return true
  if (/^localhost(:\d+)?(\/|$)/i.test(s)) return true
  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/|$)/.test(s)) return true // IPv4
  return KNOWN_TLD.test(s)
}

/** Normalize a URL-ish string into a fully-qualified, navigable URL. */
export function normalizeUrl(input: string): string {
  const s = input.trim()
  if (/^https?:\/\//i.test(s)) return s
  if (/^localhost/i.test(s) || /^\d{1,3}(\.\d{1,3}){3}/.test(s)) {
    return `http://${s}`
  }
  return `https://${s}`
}

const SEARCH_TEMPLATES: Record<string, string> = {
  google: 'https://www.google.com/search?q=',
  bing: 'https://www.bing.com/search?q=',
  duckduckgo: 'https://duckduckgo.com/?q='
}

export function searchUrl(query: string, engine: keyof typeof SEARCH_TEMPLATES = 'google'): string {
  return SEARCH_TEMPLATES[engine] + encodeURIComponent(query)
}

/**
 * Classify raw omnibox text into an intent. Confidence is a rough signal the UI
 * uses to decide whether to show a disambiguation affordance.
 */
export function classifyOmni(input: string): OmniClassification {
  const raw = input.trim()
  const lower = raw.toLowerCase()

  if (!raw) return { intent: 'search', value: '', confidence: 0 }

  // 1. Unambiguous URL.
  if (looksLikeUrl(raw)) {
    return { intent: 'url', value: normalizeUrl(raw), confidence: 0.97 }
  }

  const wordCount = raw.split(/\s+/).length

  // 2. Imperative task → hand to the agent. A leading action verb plus enough
  //    words to be a real instruction is the strongest command signal.
  const startsWithVerb = COMMAND_VERBS.some(
    (v) => lower === v || lower.startsWith(v + ' ')
  )
  if (startsWithVerb && wordCount >= 2) {
    // "search X" and "find X" are better served as a plain web search unless
    // the phrasing implies multi-step work.
    const isPlainSearch =
      (lower.startsWith('search ') || lower.startsWith('find ')) &&
      wordCount <= 6 &&
      !/\b(and|then|compare|cheapest|best|book|buy)\b/.test(lower)
    if (isPlainSearch) {
      const q = raw.replace(/^(search|find)\s+(for\s+)?/i, '')
      return { intent: 'search', value: q, confidence: 0.7 }
    }
    return { intent: 'command', value: raw, confidence: 0.85 }
  }

  // 3. Natural-language question → ask the AI.
  const firstWord = lower.split(/\s+/)[0]
  if (raw.endsWith('?') || QUESTION_STARTS.includes(firstWord)) {
    return { intent: 'ask', value: raw, confidence: 0.75 }
  }

  // 4. A short phrase is probably a search; a long one is probably a question.
  if (wordCount >= 8) {
    return { intent: 'ask', value: raw, confidence: 0.5 }
  }
  return { intent: 'search', value: raw, confidence: 0.6 }
}
