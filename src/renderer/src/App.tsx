/**
 * App — the Nova chrome shell layout.
 *
 * Three columns: the vertical tab sidebar (Arc-style), the main column
 * (command toolbar + content region), and the collapsible AI panel. The content
 * region is either a live web tab — where we render an empty, measured slot and
 * let the native WebContentsView paint into it — or one of Nova's internal
 * React pages.
 */
import { useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from './state/store'
import { useViewportBounds } from './lib/useViewportBounds'
import { TabSidebar } from './components/TabSidebar'
import { Toolbar } from './components/Toolbar'
import { AIPanel } from './components/AIPanel'
import { InternalRouter } from './components/internal/InternalRouter'
import { AgentOverlay } from './components/AgentOverlay'

export function App(): JSX.Element {
  const activeTab = useStore((s) => s.activeTab())
  const sidebarOpen = useStore((s) => s.sidebarOpen)
  const viewportRef = useRef<HTMLDivElement>(null)

  const internalPage = activeTab?.internalPage ?? null

  // Keep the native web view aligned with the content slot. Re-measures when the
  // AI panel toggles or the active tab switches between web and internal.
  useViewportBounds(viewportRef, [sidebarOpen, internalPage, activeTab?.id])

  return (
    <div className="flex h-screen w-screen overflow-hidden text-ink">
      <TabSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Toolbar />

        <div className="relative flex-1 overflow-hidden">
          {/* Live web content: an empty measured slot the native view fills. */}
          <div
            ref={viewportRef}
            className="absolute inset-0"
            style={{ visibility: internalPage ? 'hidden' : 'visible' }}
          />

          {/* Internal pages render on top of the (hidden) web slot. */}
          {internalPage && (
            <div className="absolute inset-0 overflow-y-auto">
              <InternalRouter page={internalPage} />
            </div>
          )}

          <AgentOverlay />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.div
            key="ai-panel"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 384, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="h-full shrink-0 overflow-hidden"
          >
            <AIPanel />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
