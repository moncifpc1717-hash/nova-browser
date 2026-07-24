/**
 * Robust parsing of the model's per-step JSON action.
 *
 * LLMs occasionally wrap JSON in code fences or add stray prose despite
 * instructions. This module extracts the first balanced JSON object from the
 * raw text and validates it against the AgentAction schema, so the runner only
 * ever executes well-formed, in-vocabulary actions.
 */
import type { AgentAction, AgentActionType } from '@shared/types'

const VALID_TYPES: AgentActionType[] = [
  'navigate', 'click', 'type', 'scroll', 'select', 'wait', 'extract', 'ask', 'finish'
]

/** Pull the first `{...}` balanced object out of arbitrary text. */
function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
    } else if (ch === '"') inStr = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

export interface ParseResult {
  ok: boolean
  action?: AgentAction
  error?: string
}

/** Parse and validate a raw model response into an AgentAction. */
export function parseAction(raw: string): ParseResult {
  const jsonStr = extractJsonObject(raw)
  if (!jsonStr) return { ok: false, error: 'No JSON object found in model output.' }

  let obj: Record<string, unknown>
  try {
    obj = JSON.parse(jsonStr)
  } catch (e) {
    return { ok: false, error: `Malformed JSON: ${(e as Error).message}` }
  }

  const type = obj.type as AgentActionType
  if (!VALID_TYPES.includes(type)) {
    return { ok: false, error: `Unknown action type "${String(obj.type)}".` }
  }

  const action: AgentAction = {
    type,
    reasoning: typeof obj.reasoning === 'string' ? obj.reasoning : undefined,
    sensitive: obj.sensitive === true
  }

  // Field-level validation per action type.
  switch (type) {
    case 'navigate':
      if (typeof obj.url !== 'string' || !/^https?:\/\//i.test(obj.url)) {
        return { ok: false, error: 'navigate requires a full http(s) url.' }
      }
      action.url = obj.url
      break
    case 'click':
      if (typeof obj.target !== 'number') return { ok: false, error: 'click requires a numeric target.' }
      action.target = obj.target
      break
    case 'type':
    case 'select':
      if (typeof obj.target !== 'number') return { ok: false, error: `${type} requires a numeric target.` }
      if (typeof obj.value !== 'string') return { ok: false, error: `${type} requires a string value.` }
      action.target = obj.target
      action.value = obj.value
      break
    case 'scroll':
      action.direction = (['up', 'down', 'top', 'bottom'].includes(obj.direction as string)
        ? obj.direction
        : 'down') as AgentAction['direction']
      break
    case 'wait':
      action.ms = typeof obj.ms === 'number' ? Math.min(obj.ms, 10_000) : 1000
      break
    case 'ask':
    case 'finish':
      action.message = typeof obj.message === 'string' ? obj.message : ''
      break
    case 'extract':
      break
  }

  // Safety backstop: force the sensitive flag for intrinsically risky steps even
  // if the model forgot to set it.
  if (type === 'navigate' || type === 'click') {
    const hay = `${action.url ?? ''} ${action.reasoning ?? ''}`.toLowerCase()
    if (/\b(pay|checkout|purchase|buy|order|login|log in|sign in|delete|confirm)\b/.test(hay)) {
      action.sensitive = true
    }
  }

  return { ok: true, action }
}
