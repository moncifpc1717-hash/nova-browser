/**
 * Renderer-side, human-readable descriptions of agent actions for the trace UI.
 * (The main process has its own terse variant for the LLM's scratch history;
 * this one is tuned for people, not the model.)
 */
import type { AgentAction } from '@shared/types'

export function describeStep(a: AgentAction): string {
  switch (a.type) {
    case 'navigate':
      return `Open ${prettyUrl(a.url ?? '')}`
    case 'click':
      return `Click element ${a.target}`
    case 'type':
      return `Type “${truncate(a.value ?? '', 40)}”`
    case 'select':
      return `Choose “${truncate(a.value ?? '', 40)}”`
    case 'scroll':
      return `Scroll ${a.direction ?? 'down'}`
    case 'wait':
      return `Wait ${(a.ms ?? 1000) / 1000}s`
    case 'extract':
      return 'Read the page'
    case 'ask':
      return a.message ?? 'Ask the user a question'
    case 'finish':
      return a.message ?? 'Finish'
    default:
      return a.type
  }
}

function prettyUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname.replace(/^www\./, '') + (u.pathname === '/' ? '' : u.pathname)
  } catch {
    return url
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}
