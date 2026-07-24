/**
 * AIPanel — the always-available AI sidebar.
 *
 * This is Nova's conversational core: a streaming chat grounded (optionally) in
 * the current page, a provider/model switcher, one-tap page actions (summarize,
 * translate, explain), and an embedded live trace of the autonomous agent when
 * a task is running. The whole thing speaks to the main process exclusively
 * through the controller.
 */
import { useEffect, useRef, useState } from 'react'
import { Sparkles, Trash2, ChevronDown, StopCircle } from 'lucide-react'
import type { ProviderId } from '@shared/types'
import { useStore } from '../state/store'
import { Markdown } from '../lib/markdown'
import { sendChat, stopChat } from '../lib/controller'
import { ChatComposer } from './ChatComposer'
import { AgentTrace } from './AgentTrace'

function ProviderPicker(): JSX.Element {
  const providers = useStore((s) => s.providers)
  const settings = useStore((s) => s.settings)
  const setProviders = useStore((s) => s.setProviders)
  const setSettings = useStore((s) => s.setSettings)
  const [open, setOpen] = useState(false)

  const active = providers.find((p) => p.id === settings?.activeProvider)

  const choose = async (id: ProviderId) => {
    await window.nova.ai.setActiveProvider(id)
    const [next, nextSettings] = await Promise.all([
      window.nova.ai.listProviders(),
      window.nova.settings.get()
    ])
    setProviders(next)
    setSettings(nextSettings)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1 text-xs text-ink-soft transition-colors hover:bg-white/10 focus-ring"
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${active?.configured ? 'bg-accent-mint' : 'bg-accent-amber'}`}
        />
        {active?.label ?? 'Provider'}
        <ChevronDown size={13} />
      </button>
      {open && (
        <div className="glass absolute right-0 top-full z-20 mt-1 w-52 rounded-xl p-1 shadow-2xl">
          {providers.map((p) => (
            <button
              key={p.id}
              onClick={() => void choose(p.id)}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-white/8 ${
                p.id === settings?.activeProvider ? 'text-nova-soft' : 'text-ink-soft'
              }`}
            >
              <span>{p.label}</span>
              <span
                className={`h-1.5 w-1.5 rounded-full ${p.configured ? 'bg-accent-mint' : 'bg-ink-faint'}`}
                title={p.configured ? 'Configured' : 'No API key'}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function AIPanel(): JSX.Element {
  const messages = useStore((s) => s.messages)
  const isStreaming = useStore((s) => s.isStreaming)
  const agentRun = useStore((s) => s.agentRun)
  const clearMessages = useStore((s) => s.clearMessages)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, agentRun])

  const empty = messages.length === 0 && !agentRun

  return (
    <div className="glass flex h-full w-96 flex-col border-l border-white/5">
      {/* Header. */}
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-nova-soft" />
          <span className="text-sm font-semibold">Nova</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ProviderPicker />
          <button
            onClick={clearMessages}
            title="Clear conversation"
            className="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-white/8 hover:text-ink focus-ring"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Transcript. */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {empty && <EmptyState />}

        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-nova/25 px-3.5 py-2 text-sm text-ink">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex flex-col gap-1">
              <div className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                Nova
              </div>
              <div className="max-w-full text-sm text-ink">
                <div className={m.streaming && !m.content ? 'caret' : ''}>
                  {m.content ? <Markdown text={m.content} /> : null}
                  {m.streaming && m.content ? <span className="caret" /> : null}
                </div>
              </div>
            </div>
          )
        )}

        {agentRun && <AgentTrace run={agentRun} />}
      </div>

      {/* Composer + streaming stop. */}
      <div className="border-t border-white/5 p-3">
        {isStreaming && (
          <button
            onClick={stopChat}
            className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/5 py-1.5 text-xs text-ink-soft hover:bg-white/10"
          >
            <StopCircle size={14} /> Stop generating
          </button>
        )}
        <ChatComposer />
      </div>
    </div>
  )
}

function EmptyState(): JSX.Element {
  const actions = [
    { label: 'Summarize this page', prompt: 'Summarize this page in a few clear bullet points.' },
    { label: 'Explain simply', prompt: 'Explain the content of this page in simple terms.' },
    { label: 'Key takeaways', prompt: 'What are the key takeaways from this page?' },
    { label: 'Translate to English', prompt: 'Translate the main content of this page to English.' }
  ]
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-nova to-accent-rose shadow-lg shadow-nova-glow">
        <Sparkles size={22} className="text-white" />
      </div>
      <div>
        <div className="text-sm font-semibold text-ink">Ask Nova anything</div>
        <div className="mt-1 px-4 text-xs leading-relaxed text-ink-soft">
          Chat about the page you're on, or describe a task and Nova's agent will do it for you.
        </div>
      </div>
      <div className="grid w-full grid-cols-2 gap-1.5">
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={() => void sendChat(a.prompt, true)}
            className="rounded-xl border border-white/5 bg-white/[0.03] px-2.5 py-2 text-xs text-ink-soft transition-colors hover:bg-white/[0.07] hover:text-ink"
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  )
}
