/**
 * useViewportBounds — reports the on-screen rectangle of the web-content area
 * to the main process so it can position the native WebContentsView to line up
 * exactly with the "hole" the chrome leaves for page content.
 *
 * It re-measures on element resize, window resize, and whenever a dependency
 * (like the sidebar open state) changes the layout. Using a ResizeObserver plus
 * a rAF-throttled window listener keeps the native view glued to the DOM slot
 * even during animated sidebar transitions.
 */
import { useEffect, type RefObject } from 'react'

export function useViewportBounds(ref: RefObject<HTMLElement>, deps: unknown[]): void {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    let raf = 0
    const report = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect()
        window.nova.tabs.setBounds({
          x: Math.round(r.left),
          y: Math.round(r.top),
          width: Math.round(r.width),
          height: Math.round(r.height)
        })
      })
    }

    report()
    const ro = new ResizeObserver(report)
    ro.observe(el)
    window.addEventListener('resize', report)
    // Re-measure across the sidebar's animation frames.
    const interval = window.setInterval(report, 16)
    const stop = window.setTimeout(() => window.clearInterval(interval), 400)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', report)
      window.clearInterval(interval)
      window.clearTimeout(stop)
      cancelAnimationFrame(raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
