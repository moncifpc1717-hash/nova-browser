/**
 * TabSidebar — the Arc-inspired vertical tab rail.
 *
 * Shows the active profile, a scrollable stack of tabs (favicon, title, close),
 * a "new tab" affordance, and a bottom row of shortcuts to Nova's internal
 * pages. Tabs animate in/out and highlight the active one with the brand glow.
 */
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  X,
  Globe,
  History as HistoryIcon,
  Bookmark,
  Download,
  Settings as SettingsIcon,
  Sparkles,
  Loader2,
  Bot
} from 'lucide-react'
import type { InternalPage, TabState } from '@shared/types'
import { useStore } from '../state/store'

function faviconFor(tab: TabState): JSX.Element {
  if (tab.loadState === 'loading') {
    return <Loader2 size={15} className="animate-spin text-nova-soft" />
  }
  if (tab.favicon) {
    return <img src={tab.favicon} alt="" className="h-4 w-4 rounded-sm" />
  }
  return <Globe size={15} className="text-ink-faint" />
}

function NavButton({
  icon,
  label,
  onClick,
  active
}: {
  icon: JSX.Element
  label: string
  onClick: () => void
  active?: boolean
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`app-no-drag flex h-9 w-9 items-center justify-center rounded-xl transition-colors focus-ring ${
        active ? 'bg-nova/25 text-nova-soft' : 'text-ink-soft hover:bg-white/5 hover:text-ink'
      }`}
    >
      {icon}
    </button>
  )
}

export function TabSidebar(): JSX.Element {
  const tabs = useStore((s) => s.tabs)
  const activeTabId = useStore((s) => s.activeTabId)

  const openInternal = (page: InternalPage) => {
    const existing = tabs.find((t) => t.internalPage === page)
    if (existing) void window.nova.tabs.activate(existing.id)
    else void window.nova.tabs.create(`nova://${page}`)
  }

  return (
    <aside className="glass app-drag flex h-full w-[236px] shrink-0 flex-col border-r border-white/5">
      {/* Brand / window top padding (leaves room for macOS traffic lights). */}
      <div className="flex items-center gap-2 px-4 pb-2 pt-10">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-nova to-accent-rose shadow-lg shadow-nova-glow">
          <Sparkles size={16} className="text-white" />
        </div>
        <span className="text-sm font-semibold tracking-tight">Nova</span>
      </div>

      {/* New tab. */}
      <div className="app-no-drag px-3 pb-1 pt-2">
        <button
          onClick={() => void window.nova.tabs.create()}
          className="flex w-full items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-sm text-ink-soft transition-colors hover:bg-white/[0.07] hover:text-ink focus-ring"
        >
          <Plus size={16} />
          New Tab
        </button>
      </div>

      {/* Tab list. */}
      <div className="app-no-drag flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
        <AnimatePresence initial={false}>
          {tabs.map((tab) => (
            <motion.div
              key={tab.id}
              layout
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              onClick={() => void window.nova.tabs.activate(tab.id)}
              className={`group flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors ${
                tab.id === activeTabId
                  ? 'bg-white/10 text-ink shadow-sm'
                  : 'text-ink-soft hover:bg-white/5'
              }`}
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                {faviconFor(tab)}
              </span>
              <span className="min-w-0 flex-1 truncate">{tab.title || 'Untitled'}</span>
              {tab.isAgentControlled && (
                <Bot size={13} className="shrink-0 text-accent-mint" />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  void window.nova.tabs.close(tab.id)
                }}
                className="shrink-0 rounded-md p-0.5 text-ink-faint opacity-0 transition-opacity hover:bg-white/10 hover:text-ink group-hover:opacity-100 focus-ring"
                title="Close tab"
              >
                <X size={13} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Bottom nav to internal pages. */}
      <div className="app-no-drag flex items-center justify-between gap-1 border-t border-white/5 px-3 py-2.5">
        <NavButton icon={<HistoryIcon size={17} />} label="History" onClick={() => openInternal('history')} />
        <NavButton icon={<Bookmark size={17} />} label="Bookmarks" onClick={() => openInternal('bookmarks')} />
        <NavButton icon={<Download size={17} />} label="Downloads" onClick={() => openInternal('downloads')} />
        <NavButton icon={<SettingsIcon size={17} />} label="Settings" onClick={() => openInternal('settings')} />
      </div>
    </aside>
  )
}
