/**
 * AgentTrace — the live, human-readable log of an autonomous agent run.
 *
 * Renders each step with a status glyph and the agent's own reasoning, and —
 * critically — surfaces the confirmation gate: when the agent proposes a
 * sensitive action (login, purchase, form submit), this component shows an
 * explicit Approve / Decline prompt. Nothing irreversible happens without a
 * click here.
 */
import { motion } from 'framer-motion'
import {
  Check,
  Loader2,
  CircleAlert,
  ShieldQuestion,
  X,
  Bot,
  Flag,
  MessageSquare
} from 'lucide-react'
import type { AgentActionRecord, AgentRunState } from '@shared/types'
import { describeStep } from '../lib/describe'
import { confirmAgent } from '../lib/controller'

function StatusGlyph({ record }: { record: AgentActionRecord }): JSX.Element {
  switch (record.status) {
    case 'done':
      return <Check size={13} className="text-accent-mint" />
    case 'running':
      return <Loader2 size={13} className="animate-spin text-nova-soft" />
    case 'error':
      return <CircleAlert size={13} className="text-accent-rose" />
    case 'rejected':
      return <X size={13} className="text-accent-rose" />
    case 'awaiting-confirmation':
      return <ShieldQuestion size={13} className="text-accent-amber" />
    default:
      return <div className="h-1.5 w-1.5 rounded-full bg-ink-faint" />
  }
}

export function AgentTrace({ run }: { run: AgentRunState }): JSX.Element {
  const pending = run.steps.find((s) => s.status === 'awaiting-confirmation')

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/8 bg-surface-1/70 p-3"
    >
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent-mint/20">
          <Bot size={14} className="text-accent-mint" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-ink">Agent · {statusLabel(run.status)}</div>
          <div className="truncate text-[11px] text-ink-faint">{run.goal}</div>
        </div>
      </div>

      <div className="space-y-1.5">
        {run.steps.map((s) => (
          <div key={s.id} className="flex items-start gap-2 text-[12px]">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
              <StatusGlyph record={s} />
            </span>
            <div className="min-w-0 flex-1">
              <div className={s.status === 'rejected' ? 'text-ink-faint line-through' : 'text-ink-soft'}>
                {describeStep(s.action)}
              </div>
              {s.action.reasoning && (
                <div className="text-[11px] italic text-ink-faint">{s.action.reasoning}</div>
              )}
              {s.error && <div className="text-[11px] text-accent-rose/80">{s.error}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Confirmation gate. */}
      {pending && (
        <div className="mt-3 rounded-xl border border-accent-amber/30 bg-accent-amber/10 p-2.5">
          <div className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-accent-amber">
            <ShieldQuestion size={14} />
            Confirmation required
          </div>
          <p className="mb-2.5 text-[12px] text-ink-soft">
            Nova wants to {describeStep(pending.action).toLowerCase()}. This looks sensitive — approve it?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => confirmAgent(true)}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-accent-mint/90 py-1.5 text-[12px] font-medium text-surface-0 transition-colors hover:bg-accent-mint"
            >
              <Check size={13} /> Approve
            </button>
            <button
              onClick={() => confirmAgent(false)}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-white/8 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:bg-white/12"
            >
              <X size={13} /> Decline
            </button>
          </div>
        </div>
      )}

      {/* Terminal result. */}
      {run.finalAnswer && (run.status === 'done' || run.status === 'paused') && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-white/5 p-2.5 text-[12px] text-ink">
          {run.status === 'paused' ? (
            <MessageSquare size={14} className="mt-0.5 shrink-0 text-nova-soft" />
          ) : (
            <Flag size={14} className="mt-0.5 shrink-0 text-accent-mint" />
          )}
          <span>{run.finalAnswer}</span>
        </div>
      )}
    </motion.div>
  )
}

function statusLabel(status: AgentRunState['status']): string {
  switch (status) {
    case 'planning':
      return 'thinking'
    case 'acting':
      return 'working'
    case 'paused':
      return 'waiting for you'
    case 'done':
      return 'done'
    case 'error':
      return 'error'
    default:
      return 'idle'
  }
}
