/**
 * Omnibox — Nova's unified natural-language input.
 *
 * A single field that accepts a URL, a search, a question, or a multi-step task.
 * As the user types, a local heuristic classifies the intent and shows a badge
 * so the action is never a surprise: a link opens a page, a question opens the
 * AI, a command hands off to the autonomous agent. Enter commits.
 */
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Search, Globe, MessageCircleQuestion, Wand2 } from 'lucide-react'
import type { OmniIntent } from '@shared/types'
import { classifyOmni } from '@shared/omnibox'
import { useStore } from '../state/store'
import { submitOmni } from '../lib/controller'

const INTENT_META: Record<OmniIntent, { label: string; icon: JSX.Element; color: string }> = {
  url: { label: 'Open', icon: <Globe size={14} />, color: 'text-accent-mint' },
  search: { label: 'Search', icon: <Search size={14} />, color: 'text-ink-soft' },
  ask: { label: 'Ask Nova', icon: <MessageCircleQuestion size={14} />, color: 'text-nova-soft' },
  command: { label: 'Run task', icon: <Wand2 size={14} />, color: 'text-accent-amber' }
}

export function Omnibox(): JSX.Element {
  const activeTab = useStore((s) => s.activeTab())
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)

  // Reflect the active tab's URL when not actively editing.
  useEffect(() => {
    if (!focused) {
      const url = activeTab?.internalPage ? '' : activeTab?.url ?? ''
      setValue(url === 'nova://new-tab' ? '' : url)
    }
  }, [activeTab?.url, activeTab?.internalPage, focused])

  const intent = useMemo<OmniIntent>(
    () => (value.trim() ? classifyOmni(value).intent : 'search'),
    [value]
  )
  const meta = INTENT_META[intent]

  const submit = () => {
    const v = value.trim()
    if (!v) return
    void submitOmni(v)
    if (intent === 'ask' || intent === 'command') setValue('')
    ;(document.activeElement as HTMLElement | null)?.blur()
  }

  return (
    <div
      className={`app-no-drag group flex flex-1 items-center gap-2 rounded-xl border px-3 py-1.5 transition-all ${
        focused
          ? 'border-nova/50 bg-surface-2/80 shadow-lg shadow-nova-glow'
          : 'border-white/5 bg-white/[0.04] hover:bg-white/[0.06]'
      }`}
    >
      <span className={`shrink-0 transition-colors ${focused ? meta.color : 'text-ink-faint'}`}>
        {meta.icon}
      </span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={(e) => {
          setFocused(true)
          e.target.select()
        }}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') (e.target as HTMLInputElement).blur()
        }}
        spellCheck={false}
        placeholder="Search, type a URL, ask a question, or describe a task…"
        className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
      />
      {value.trim() && (
        <span
          className={`flex shrink-0 items-center gap-1 rounded-lg bg-white/5 px-2 py-0.5 text-[11px] font-medium ${meta.color}`}
        >
          {meta.label}
        </span>
      )}
      <button
        onClick={submit}
        disabled={!value.trim()}
        className="shrink-0 rounded-lg p-1 text-ink-soft transition-colors hover:bg-white/10 hover:text-ink disabled:opacity-0 focus-ring"
        title="Go"
      >
        <ArrowRight size={16} />
      </button>
    </div>
  )
}
