import { BrowserWindow, ipcMain } from 'electron'
import {
  Account,
  AccountCreateInput,
  AccountUpdateInput,
  AppSettings,
  ViewBounds
} from '../shared/types'
import { AppStore } from './store'
import { ViewManager } from './viewManager'
import { NotificationBridge } from './notificationBridge'

export function registerIpcHandlers(
  mainWindow: BrowserWindow,
  store: AppStore,
  viewManager: ViewManager,
  notificationBridge: NotificationBridge
): void {
  // Accounts
  ipcMain.handle('accounts:get-all', () => {
    return store.getAccounts()
  })

  ipcMain.handle('accounts:add', (_event, input: AccountCreateInput) => {
    const newAccount: Account = {
      id: `acc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      serviceId: input.serviceId,
      label: input.label.trim() || 'Account',
      color: input.color || '#3b82f6',
      order: store.getAccounts().length,
      isMuted: false,
      isHibernated: false,
      customUserAgent: input.customUserAgent?.trim() || undefined,
      unreadCount: 0,
      createdAt: Date.now()
    }

    store.addAccount(newAccount)
    mainWindow.webContents.send('accounts:updated', store.getAccounts())

    // Auto-select if first account
    if (store.getAccounts().length === 1) {
      viewManager.selectAccount(newAccount)
      mainWindow.webContents.send('view:active-changed', newAccount.id)
    }

    return newAccount
  })

  ipcMain.handle('accounts:update', (_event, input: AccountUpdateInput) => {
    const existing = store.getAccount(input.id)
    if (!existing) return null

    const wasHibernated = existing.isHibernated
    const updated = store.updateAccount(input.id, {
      ...(input.label !== undefined && { label: input.label.trim() }),
      ...(input.color !== undefined && { color: input.color }),
      ...(input.isMuted !== undefined && { isMuted: input.isMuted }),
      ...(input.isHibernated !== undefined && { isHibernated: input.isHibernated }),
      ...(input.customUserAgent !== undefined && {
        customUserAgent: input.customUserAgent.trim() || undefined
      })
    })

    if (updated) {
      // If hibernation status changed
      if (input.isHibernated !== undefined && input.isHibernated !== wasHibernated) {
        if (input.isHibernated) {
          viewManager.hibernateAccount(updated)
        } else {
          viewManager.wakeAccount(updated)
        }
      }

      notificationBridge.syncBadgeCount()
      mainWindow.webContents.send('accounts:updated', store.getAccounts())
    }

    return updated
  })

  ipcMain.handle('accounts:remove', (_event, id: string) => {
    viewManager.removeAccount(id)
    const removed = store.removeAccount(id)

    if (removed) {
      const remaining = store.getAccounts()
      const newActiveId = store.getActiveAccountId()
      const nextActiveAccount = remaining.find((a) => a.id === newActiveId) || remaining[0] || null

      viewManager.selectAccount(nextActiveAccount)
      notificationBridge.syncBadgeCount()
      mainWindow.webContents.send('accounts:updated', remaining)
      mainWindow.webContents.send('view:active-changed', nextActiveAccount?.id || null)
    }

    return removed
  })

  ipcMain.handle('accounts:reorder', (_event, accountIds: string[]) => {
    const reordered = store.reorderAccounts(accountIds)
    mainWindow.webContents.send('accounts:updated', reordered)
    return reordered
  })

  // View management
  ipcMain.handle('view:select-account', (_event, accountId: string | null) => {
    store.setActiveAccountId(accountId)
    const account = accountId ? store.getAccount(accountId) || null : null
    viewManager.selectAccount(account)
    mainWindow.webContents.send('view:active-changed', accountId)
  })

  ipcMain.handle('view:get-active-account', () => {
    return store.getActiveAccountId()
  })

  ipcMain.handle('view:update-bounds', (_event, bounds: ViewBounds) => {
    viewManager.setBounds(bounds)
  })

  ipcMain.handle('view:reload', (_event, accountId: string) => {
    viewManager.reloadAccount(accountId)
  })

  ipcMain.handle('view:go-back', (_event, accountId: string) => {
    viewManager.navigateBack(accountId)
  })

  ipcMain.handle('view:go-forward', (_event, accountId: string) => {
    viewManager.navigateForward(accountId)
  })

  ipcMain.handle('view:hibernate', (_event, accountId: string) => {
    const account = store.getAccount(accountId)
    if (account) {
      store.updateAccount(accountId, { isHibernated: true })
      viewManager.hibernateAccount(account)
      mainWindow.webContents.send('accounts:updated', store.getAccounts())
    }
  })

  ipcMain.handle('view:wake', (_event, accountId: string) => {
    const account = store.getAccount(accountId)
    if (account) {
      store.updateAccount(accountId, { isHibernated: false })
      viewManager.wakeAccount(account)
      mainWindow.webContents.send('accounts:updated', store.getAccounts())
    }
  })

  // Settings
  ipcMain.handle('settings:get', () => {
    return store.getSettings()
  })

  ipcMain.handle('settings:update', (_event, newSettings: Partial<AppSettings>) => {
    const updated = store.updateSettings(newSettings)
    notificationBridge.syncBadgeCount()
    mainWindow.webContents.send('settings:updated', updated)
    return updated
  })

  // Service View Injected Preload Events
  ipcMain.on('service:unread-count', (event, count: number) => {
    const accountId = viewManager.findAccountIdByWebContents(event.sender)
    if (accountId) {
      notificationBridge.handleUnreadCountUpdate(accountId, count)
    }
  })

  ipcMain.on('service:notification', (event, payload: { title: string; body: string; icon?: string }) => {
    const accountId = viewManager.findAccountIdByWebContents(event.sender)
    if (accountId) {
      const account = store.getAccount(accountId)
      if (account) {
        notificationBridge.handleNotification({
          accountId,
          serviceId: account.serviceId,
          title: payload.title,
          body: payload.body,
          icon: payload.icon
        })
      }
    }
  })

  // Callback when notification is clicked to focus an account
  notificationBridge.setOnAccountFocusRequested((accountId) => {
    const account = store.getAccount(accountId)
    if (account) {
      store.setActiveAccountId(accountId)
      viewManager.selectAccount(account)
      mainWindow.webContents.send('view:active-changed', accountId)
    }
  })
}
