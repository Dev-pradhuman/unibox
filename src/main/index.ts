import { app, BrowserWindow, globalShortcut, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { AppStore } from './store'
import { SessionManager } from './sessionManager'
import { NotificationBridge } from './notificationBridge'
import { ViewManager } from './viewManager'
import { registerIpcHandlers } from './ipc'

let mainWindow: BrowserWindow | null = null
let store: AppStore
let sessionManager: SessionManager
let notificationBridge: NotificationBridge
let viewManager: ViewManager

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 860,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'Unibox',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => {
    win.show()
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Load renderer
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

function registerShortcuts(): void {
  // Cmd/Ctrl+K for Quick Switcher
  globalShortcut.register('CommandOrControl+K', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('shortcut:quick-switcher')
    }
  })

  // Cmd/Ctrl+1..9 for Direct Account Switching
  for (let i = 1; i <= 9; i++) {
    globalShortcut.register(`CommandOrControl+${i}`, () => {
      if (!store || !viewManager || !mainWindow || mainWindow.isDestroyed()) return
      const accounts = store.getAccounts()
      const targetAccount = accounts[i - 1]
      if (targetAccount) {
        store.setActiveAccountId(targetAccount.id)
        viewManager.selectAccount(targetAccount)
        mainWindow.webContents.send('view:active-changed', targetAccount.id)
      }
    })
  }
}

app.whenReady().then(() => {
  store = new AppStore()
  mainWindow = createWindow()

  sessionManager = SessionManager.getInstance()
  notificationBridge = new NotificationBridge(mainWindow, store)
  viewManager = new ViewManager(mainWindow, sessionManager, notificationBridge)

  registerIpcHandlers(mainWindow, store, viewManager, notificationBridge)
  registerShortcuts()

  notificationBridge.syncBadgeCount()

  // Restore active account once main window DOM finishes loading
  mainWindow.webContents.once('did-finish-load', () => {
    const activeId = store.getActiveAccountId()
    const accounts = store.getAccounts()
    const activeAcc = (activeId && accounts.find((a) => a.id === activeId)) || accounts[0] || null

    if (activeAcc) {
      store.setActiveAccountId(activeAcc.id)
      viewManager.selectAccount(activeAcc)
      mainWindow?.webContents.send('view:active-changed', activeAcc.id)
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
