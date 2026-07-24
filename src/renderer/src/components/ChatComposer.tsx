/**
 * ChatComposer — the AI panel's input.
 *
 * A growing textarea with a "use page context" toggle. On submit it classifies
 * the text: a task-like command launches the autonomous agent, anything else is
 * a chat turn. Enter sends; Shift+Enter inserts a newline.
 */
import { useState } from 'react'
import { ArrowUp, FileText } from 'lucide-react'
import { classifyOmni } from '@shared/omnibox'
import { useStore } from '../state/store'
import { runAgent, sendChat } from '../lib/controller'

export function ChatComposer(): JSX.Element {
  const isStreaming = useStore((s) => s.isStreaming)
  const [text, setText] = useState('')
  const [usePage, setUsePage] = useState(true)

  const submit = () => {
    const v = text.trim()
    if (!v || isStreaming) return
    setText('')
    const intent = classifyOmni(v).intent
    if (intent === 'command') void runAgent(v)
    else void sendChat(v, usePage)
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-surface-2/60 p-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
        }}
        rows={2}
        placeholder="Message Nova, or describe a task…"
        className="max-h-40 w-full resize-none bg-transparent px-1.5 py-1 text-sm text-ink placeholder:text-ink-faint focus:outline-none"
      />
      <div className="flex items-center justify-between px-0.5 pt-1">
        <button
          onClick={() => setUsePage((v) => !v)}
          title="Include the current page as context"
          className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] transition-colors ${
            usePage ? 'bg-nova/20 text-nova-soft' : 'text-ink-faint hover:bg-white/5'
          }`}
        >
          <FileText size={13} />
          Page context {usePage ? 'on' : 'off'}
        </button>
        <button
          onClick={submit}
          disabled={!text.trim() || isStreaming}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-nova text-white transition-all hover:bg-nova-soft disabled:opacity-30 focus-ring"
          title="Send"
        >
          <ArrowUp size={16} />
        </button>
      </div>
    </div>
  )
}
