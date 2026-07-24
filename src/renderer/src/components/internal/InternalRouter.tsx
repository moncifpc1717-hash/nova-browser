/**
 * InternalRouter — maps a tab's `internalPage` to Nova's built-in React pages.
 * These render inside the chrome shell (the native web view is hidden for the
 * tab), so they share the app's glassy aesthetic rather than looking like a
 * remote website.
 */
import type { InternalPage } from '@shared/types'
import { NewTabPage } from './NewTabPage'
import { SettingsPage } from './SettingsPage'
import { HistoryPage } from './HistoryPage'
import { BookmarksPage } from './BookmarksPage'
import { DownloadsPage } from './DownloadsPage'

export function InternalRouter({ page }: { page: InternalPage }): JSX.Element {
  switch (page) {
    case 'settings':
      return <SettingsPage />
    case 'history':
      return <HistoryPage />
    case 'bookmarks':
      return <BookmarksPage />
    case 'downloads':
      return <DownloadsPage />
    case 'new-tab':
    default:
      return <NewTabPage />
  }
}
