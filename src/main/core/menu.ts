/**
 * Application menu + global shortcuts.
 *
 * Keeps native menu wiring out of the bootstrap file. Shortcuts delegate to the
 * TabManager / renderer so behavior matches the in-app buttons exactly.
 */
import { Menu, type MenuItemConstructorOptions } from 'electron'
import type { AppContext } from './app-context'

export function buildMenu(ctx: AppContext): void {
  const isMac = process.platform === 'darwin'
  const activeTabId = () => ctx.tabs.getAll().find((t) => t.isActive)?.id ?? null

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [{ role: 'appMenu' as const }]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Tab',
          accelerator: 'CmdOrCtrl+T',
          click: () => ctx.tabs.create()
        },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            const id = activeTabId()
            if (id) ctx.tabs.close(id)
          }
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload Page',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            const id = activeTabId()
            if (id) ctx.tabs.reload(id)
          }
        },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' }
      ]
    },
    {
      label: 'History',
      submenu: [
        {
          label: 'Back',
          accelerator: isMac ? 'Cmd+Left' : 'Alt+Left',
          click: () => {
            const id = activeTabId()
            if (id) ctx.tabs.back(id)
          }
        },
        {
          label: 'Forward',
          accelerator: isMac ? 'Cmd+Right' : 'Alt+Right',
          click: () => {
            const id = activeTabId()
            if (id) ctx.tabs.forward(id)
          }
        },
        { type: 'separator' },
        {
          label: 'Show Full History',
          accelerator: 'CmdOrCtrl+Y',
          click: () => ctx.tabs.create('nova://history')
        }
      ]
    },
    { role: 'windowMenu' }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}
