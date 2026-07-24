/**
 * PageShell — a consistent frame for internal pages: centered column, title,
 * optional description and header actions. Keeps every internal page visually
 * coherent without repeating layout boilerplate.
 */
import type { ReactNode } from 'react'

export function PageShell({
  title,
  description,
  actions,
  children
}: {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}): JSX.Element {
  return (
    <div className="mx-auto min-h-full w-full max-w-3xl px-8 py-12">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  )
}
