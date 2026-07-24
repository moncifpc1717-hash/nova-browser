/**
 * NewTabPage — Nova's home surface. Instead of a search box, it centers a
 * natural-language command bar: type a URL, a search, a question, or a task.
 * Below it, quick shortcuts and example capabilities orient new users toward
 * what makes Nova different from a normal browser.
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Search, Globe, Wand2, MessageCircleQuestion } from 'lucide-react'
import { classifyOmni } from '@shared/omnibox'
import type { OmniIntent } from '@shared/types'
import { submitOmni } from '../../lib/controller'

const EXAMPLES: { icon: JSX.Element; text: string }[] = [
  { icon: <Wand2 size={14} className="text-accent-amber" />, text: 'Find the cheapest iPhone 15 and compare prices' },
  { icon: <MessageCircleQuestion size={14} className="text-nova-soft" />, text: 'What is this page about?' },
  { icon: <Globe size={14} className="text-accent-mint" />, text: 'youtube.com' },
  { icon: <Search size={14} className="text-ink-soft" />, text: 'best mechanical keyboards 2026' }
]

const SHORTCUTS = [
  { label: 'YouTube', url: 'https://youtube.com' },
  { label: 'Gmail', url: 'https://mail.google.com' },
  { label: 'GitHub', url: 'https://github.com' },
  { label: 'Wikipedia', url: 'https://wikipedia.org' },
  { label: 'Maps', url: 'https://maps.google.com' },
  { label: 'X', url: 'https://x.com' }
]

const INTENT_HINT: Record<OmniIntent, string> = {
  url: 'Press Enter to open this site',
  search: 'Press Enter to search the web',
  ask: 'Press Enter to ask Nova',
  command: 'Press Enter and Nova’s agent will do this for you'
}

export function NewTabPage(): JSX.Element {
  const [value, setValue] = useState('')
  const intent = value.trim() ? classifyOmni(value).intent : null

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-8 py-16">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-2xl"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-nova to-accent-rose shadow-2xl shadow-nova-glow">
            <Sparkles size={30} className="text-white" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">
            What would you like to do?
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            Nova isn’t a browser with AI bolted on. The AI <em>is</em> the browser.
          </p>
        </div>

        <div className="glass rounded-2xl p-2 shadow-2xl">
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && value.trim()) {
                void submitOmni(value.trim())
                setValue('')
              }
            }}
            placeholder="Type a URL, search, ask a question, or describe a task…"
            spellCheck={false}
            className="w-full bg-transparent px-4 py-3 text-base text-ink placeholder:text-ink-faint focus:outline-none"
          />
        </div>
        <div className="mt-2 h-5 text-center text-xs text-ink-faint">
          {intent ? INTENT_HINT[intent] : ' '}
        </div>

        {/* Shortcuts. */}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {SHORTCUTS.map((s) => (
            <button
              key={s.label}
              onClick={() => void submitOmni(s.url)}
              className="rounded-xl border border-white/5 bg-white/[0.03] px-3.5 py-1.5 text-xs text-ink-soft transition-colors hover:bg-white/[0.07] hover:text-ink"
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Example capabilities. */}
        <div className="mt-10">
          <div className="mb-2.5 text-center text-[11px] font-medium uppercase tracking-wide text-ink-faint">
            Try asking
          </div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.text}
                onClick={() => void submitOmni(ex.text)}
                className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 text-left text-[13px] text-ink-soft transition-colors hover:bg-white/[0.06] hover:text-ink"
              >
                <span className="shrink-0">{ex.icon}</span>
                <span className="truncate">{ex.text}</span>
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
