/**
 * Toolbar — the top command bar of the main column.
 *
 * Holds navigation controls (back/forward/reload), the Omnibox, a bookmark
 * toggle, the AI-panel toggle, and (on non-macOS) the frameless window
 * controls. The whole bar is a drag region except for the interactive controls.
 */
import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Star,
  PanelRight,
  Minus,
  Square,
  X
} from 'lucide-react'
import { useStore } from '../state/store'
import { Omnibox } from './Omnibox'

function IconBtn({
  children,
  onClick,
  disabled,
  title,
  active
}: {
  children: JSX.Element
  onClick?: () => void
  disabled?: boolean
  title?: string
  active?: boolean
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`app-no-drag flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-ring ${
        active ? 'bg-nova/25 text-nova-soft' : 'text-ink-soft hover:bg-white/8 hover:text-ink'
      } disabled:cursor-default disabled:opacity-30`}
    >
      {children}
    </button>
  )
}

export function Toolbar(): JSX.Element {
  const activeTab = useStore((s) => s.activeTab())
  const sidebarOpen = useStore((s) => s.sidebarOpen)
  const toggleSidebar = useStore((s) => s.toggleSidebar)
  const [bookmarked, setBookmarked] = useState(false)
  const isMac = navigator.userAgent.includes('Mac')

  const id = activeTab?.id
  const canGoBack = activeTab?.canGoBack ?? false
  const canGoForward = activeTab?.canGoForward ?? false
  const isWeb = activeTab && !activeTab.internalPage

  // Reflect whether the current page is already bookmarked.
  useEffect(() => {
    let alive = true
    if (isWeb && activeTab) {
      void window.nova.bookmarks.list().then((list) => {
        if (alive) setBookmarked(list.some((b) => b.url === activeTab.url))
      })
    } else {
      setBookmarked(false)
    }
    return () => {
      alive = false
    }
  }, [activeTab?.url, isWeb, activeTab])

  const toggleBookmark = async () => {
    if (!activeTab || !isWeb) return
    const list = await window.nova.bookmarks.list()
    const existing = list.find((b) => b.url === activeTab.url)
    if (existing) {
      await window.nova.bookmarks.remove(existing.id)
      setBookmarked(false)
    } else {
      await window.nova.bookmarks.add({
        url: activeTab.url,
        title: activeTab.title,
        favicon: activeTab.favicon,
        folder: 'Bookmarks'
      })
      setBookmarked(true)
    }
  }

  return (
    <header className="app-drag flex items-center gap-2 px-3 py-2">
      <div className="flex items-center gap-0.5">
        <IconBtn onClick={() => id && window.nova.tabs.back(id)} disabled={!canGoBack} title="Back">
          <ArrowLeft size={17} />
        </IconBtn>
        <IconBtn
          onClick={() => id && window.nova.tabs.forward(id)}
          disabled={!canGoForward}
          title="Forward"
        >
          <ArrowRight size={17} />
        </IconBtn>
        <IconBtn onClick={() => id && window.nova.tabs.reload(id)} disabled={!isWeb} title="Reload">
          <RotateCw size={15} />
        </IconBtn>
      </div>

      <Omnibox />

      <div className="flex items-center gap-0.5">
        <IconBtn onClick={toggleBookmark} disabled={!isWeb} title="Bookmark" active={bookmarked}>
          <Star size={16} fill={bookmarked ? 'currentColor' : 'none'} />
        </IconBtn>
        <IconBtn onClick={toggleSidebar} title="Toggle AI panel" active={sidebarOpen}>
          <PanelRight size={16} />
        </IconBtn>
      </div>

      {!isMac && (
        <div className="ml-1 flex items-center gap-0.5">
          <IconBtn onClick={() => window.nova.window.minimize()} title="Minimize">
            <Minus size={15} />
          </IconBtn>
          <IconBtn onClick={() => window.nova.window.maximize()} title="Maximize">
            <Square size={12} />
          </IconBtn>
          <button
            onClick={() => window.nova.window.close()}
            title="Close"
            className="app-no-drag flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-accent-rose hover:text-white focus-ring"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </header>
  )
}
