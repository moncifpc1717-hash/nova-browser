/**
 * Main process entry point.
 *
 * Bootstraps the OS window, mounts the Nova chrome (React shell) as a
 * full-window WebContentsView, wires the entire service graph via
 * `createAppContext`, registers IPC, and opens the first tab. Web tabs are
 * separate WebContentsViews layered on top of the chrome by the TabManager.
 */
import { app, BaseWindow, WebContentsView, shell } from 'electron'
import { join } from 'node:path'
import { createAppContext, type AppContext } from './core/app-context'
import { registerIpc } from './ipc/register-ipc'
import { buildMenu } from './core/menu'

/** electron-vite injects the dev server URL; in prod we load the built file. */
const RENDERER_DEV_URL = process.env['ELECTRON_RENDERER_URL']

let context: AppContext | null = null

function resolveRendererUrl(): string {
  return RENDERER_DEV_URL ?? `file://${join(__dirname, '../renderer/index.html')}`
}

async function createWindow(): Promise<void> {
  const window = new BaseWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#101016',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    title: 'Nova'
  })

  // The chrome shell: Nova's React UI. It fills the window and sits beneath the
  // web-content views. It's the only view with the privileged preload bridge.
  const chromeView = new WebContentsView({
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  window.contentView.addChildView(chromeView)

  const layoutChrome = (): void => {
    const { width, height } = window.getContentBounds()
    chromeView.setBounds({ x: 0, y: 0, width, height })
  }
  layoutChrome()
  window.on('resize', layoutChrome)

  // Wire the whole service graph *before* loading the UI, so IPC handlers exist
  // by the time the renderer's bootstrap() starts invoking them.
  const rendererUrl = resolveRendererUrl()
  context = await createAppContext({
    window,
    chrome: chromeView.webContents,
    rendererUrl
  })
  registerIpc(context)
  buildMenu(context)

  // External links that escape the app open in the user's default browser.
  chromeView.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  // Open the first tab as soon as the renderer has finished loading. The
  // renderer subscribes to TABS_CHANGED synchronously on startup and also
  // re-fetches via getAll() in bootstrap(), so the tab surfaces either way.
  chromeView.webContents.once('did-finish-load', () => {
    context?.tabs.create()
  })

  if (RENDERER_DEV_URL) {
    await chromeView.webContents.loadURL(RENDERER_DEV_URL)
  } else {
    await chromeView.webContents.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  app.setName('Nova')
  await createWindow()

  app.on('activate', () => {
    if (BaseWindow.getAllWindows().length === 0) void createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  context?.db.close()
})
