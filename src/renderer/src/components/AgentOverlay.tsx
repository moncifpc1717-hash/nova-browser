/**
 * AgentOverlay — a slim banner pinned to the top of the web viewport whenever
 * the autonomous agent is driving the *currently visible* tab. It reassures the
 * user that automation is active and gives a one-click stop. The native web
 * view paints below it, so this floats over live page content.
 */
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, StopCircle } from 'lucide-react'
import { useStore } from '../state/store'

export function AgentOverlay(): JSX.Element {
  const agentRun = useStore((s) => s.agentRun)
  const activeTabId = useStore((s) => s.activeTabId)

  const active =
    agentRun &&
    (agentRun.status === 'acting' || agentRun.status === 'planning') &&
    agentRun.tabId === activeTabId

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center p-2.5"
        >
          <div className="glass pointer-events-auto flex items-center gap-3 rounded-full border border-accent-mint/30 px-4 py-1.5 shadow-xl">
            <span className="flex items-center gap-2 text-xs font-medium text-ink">
              <Bot size={14} className="text-accent-mint" />
              Nova is controlling this tab…
            </span>
            <button
              onClick={() => agentRun && window.nova.agent.abort(agentRun.id)}
              className="flex items-center gap-1 rounded-full bg-white/8 px-2 py-0.5 text-[11px] text-ink-soft transition-colors hover:bg-accent-rose hover:text-white"
            >
              <StopCircle size={12} /> Stop
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
