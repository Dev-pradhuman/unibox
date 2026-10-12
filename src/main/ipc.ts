import { randomUUID } from 'crypto'
import { BrowserWindow, ipcMain } from 'electron'
import {
  Account,
  AccountCreateInput,
  AccountUpdateInput,
  AppSettings,
  ViewBounds
} from '../shared/types'
import { SERVICES_CONFIG } from '../shared/services'
import { AppStore } from './store'
import { ViewManager } from './viewManager'
import { NotificationBridge } from './notificationBridge'
import { SessionManager } from './sessionManager'
import {
  assertTrustedRenderer,
  sanitizeBadgeCount,
  sanitizeNotificationPayload
} from './security'

export function registerIpcHandlers(
  mainWindow: BrowserWindow,
  store: AppStore,
  viewManager: ViewManager,
  notificationBridge: NotificationBridge,
  sessionManager: SessionManager
): void {
  // Accounts
  ipcMain.handle('accounts:get-all', (event) => {
    assertTrustedRenderer(event, mainWindow)
    return store.getAccounts()
  })

  ipcMain.handle('accounts:add', (event, input: AccountCreateInput) => {
    assertTrustedRenderer(event, mainWindow)

    if (!input || typeof input !== 'object') {
      throw new Error('[Unibox Security] Invalid account payload')
    }

    if (!SERVICES_CONFIG[input.serviceId]) {
      throw new Error(`[Unibox Security] Unknown service identifier: ${input.serviceId}`)
    }

    const label = typeof input.label === 'string' ? input.label.trim().slice(0, 100) : ''
    const color = typeof input.color === 'string' ? input.color.slice(0, 30) : '#3b82f6'
    const customUserAgent =
      typeof input.customUserAgent === 'string' && input.customUserAgent.trim()
        ? input.customUserAgent.trim().slice(0, 500)
        : undefined

    const newAccount: Account = {
      id: `acc_${randomUUID()}`,
      serviceId: input.serviceId,
      label: label || `${SERVICES_CONFIG[input.serviceId].name} Account`,
      color: color || '#3b82f6',
      order: store.getAccounts().length,
      isMuted: false,
      isHibernated: false,
      customUserAgent,
      unreadCount: 0,
      createdAt: Date.now()
    }

    store.addAccount(newAccount)
    store.setActiveAccountId(newAccount.id)
    viewManager.selectAccount(newAccount)
    mainWindow.webContents.send('accounts:updated', store.getAccounts())
    mainWindow.webContents.send('view:active-changed', newAccount.id)

    return newAccount
  })

  ipcMain.handle('accounts:update', (event, input: AccountUpdateInput) => {
    assertTrustedRenderer(event, mainWindow)

    if (!input || typeof input !== 'object' || typeof input.id !== 'string') {
      throw new Error('[Unibox Security] Invalid account update payload')
    }

    const existing = store.getAccount(input.id)
    if (!existing) return null

    const wasHibernated = existing.isHibernated
    const updated = store.updateAccount(input.id, {
      ...(typeof input.label === 'string' && { label: input.label.trim().slice(0, 100) }),
      ...(typeof input.color === 'string' && { color: input.color.slice(0, 30) }),
      ...(typeof input.isMuted === 'boolean' && { isMuted: input.isMuted }),
      ...(typeof input.isHibernated === 'boolean' && { isHibernated: input.isHibernated }),
      ...(input.customUserAgent !== undefined && {
        customUserAgent:
          typeof input.customUserAgent === 'string' && input.customUserAgent.trim()
            ? input.customUserAgent.trim().slice(0, 500)
            : undefined
      })
    })

    if (updated) {
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

  ipcMain.handle('accounts:remove', async (event, id: string) => {
    assertTrustedRenderer(event, mainWindow)

    if (typeof id !== 'string' || !id) {
      throw new Error('[Unibox Security] Invalid account ID for removal')
    }

    const account = store.getAccount(id)
    if (!account) return false

    // 1. Detach and close WebContentsView
    viewManager.removeAccount(id)

    // 2. Wipe on-disk storage data (cookies, cache, indexedDB, localStorage)
    await sessionManager.eraseSession(account)

    // 3. Remove from persistence store
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

  ipcMain.handle('accounts:reorder', (event, accountIds: string[]) => {
    assertTrustedRenderer(event, mainWindow)

    if (!Array.isArray(accountIds)) {
      throw new Error('[Unibox Security] Invalid account IDs array')
    }

    const reordered = store.reorderAccounts(accountIds.filter((id) => typeof id === 'string'))
    mainWindow.webContents.send('accounts:updated', reordered)
    return reordered
  })

  // View management
  ipcMain.handle('view:select-account', (event, accountId: string | null) => {
    assertTrustedRenderer(event, mainWindow)

    const targetId = typeof accountId === 'string' ? accountId : null
    store.setActiveAccountId(targetId)
    const account = targetId ? store.getAccount(targetId) || null : null
    viewManager.selectAccount(account)
    mainWindow.webContents.send('view:active-changed', targetId)
  })

  ipcMain.handle('view:get-active-account', (event) => {
    assertTrustedRenderer(event, mainWindow)
    return store.getActiveAccountId()
  })

  ipcMain.handle('view:update-bounds', (event, bounds: ViewBounds) => {
    assertTrustedRenderer(event, mainWindow)

    if (
      bounds &&
      typeof bounds.x === 'number' &&
      typeof bounds.y === 'number' &&
      typeof bounds.width === 'number' &&
      typeof bounds.height === 'number'
    ) {
      viewManager.setBounds(bounds)
    }
  })

  ipcMain.handle('view:set-visible', (event, visible: boolean) => {
    assertTrustedRenderer(event, mainWindow)
    viewManager.setViewsVisible(Boolean(visible))
  })

  ipcMain.handle('view:reload', (event, accountId: string) => {
    assertTrustedRenderer(event, mainWindow)
    if (typeof accountId === 'string') {
      viewManager.reloadAccount(accountId)
    }
  })

  ipcMain.handle('view:go-back', (event, accountId: string) => {
    assertTrustedRenderer(event, mainWindow)
    if (typeof accountId === 'string') {
      viewManager.navigateBack(accountId)
    }
  })

  ipcMain.handle('view:go-forward', (event, accountId: string) => {
    assertTrustedRenderer(event, mainWindow)
    if (typeof accountId === 'string') {
      viewManager.navigateForward(accountId)
    }
  })

  ipcMain.handle('view:hibernate', (event, accountId: string) => {
    assertTrustedRenderer(event, mainWindow)
    if (typeof accountId === 'string') {
      const account = store.getAccount(accountId)
      if (account) {
        store.updateAccount(accountId, { isHibernated: true })
        viewManager.hibernateAccount(account)
        mainWindow.webContents.send('accounts:updated', store.getAccounts())
      }
    }
  })

  ipcMain.handle('view:wake', (event, accountId: string) => {
    assertTrustedRenderer(event, mainWindow)
    if (typeof accountId === 'string') {
      const account = store.getAccount(accountId)
      if (account) {
        store.updateAccount(accountId, { isHibernated: false })
        viewManager.wakeAccount(account)
        mainWindow.webContents.send('accounts:updated', store.getAccounts())
      }
    }
  })

  // Settings
  ipcMain.handle('settings:get', (event) => {
    assertTrustedRenderer(event, mainWindow)
    return store.getSettings()
  })

  ipcMain.handle('settings:update', (event, newSettings: Partial<AppSettings>) => {
    assertTrustedRenderer(event, mainWindow)

    if (!newSettings || typeof newSettings !== 'object') {
      throw new Error('[Unibox Security] Invalid settings object')
    }

    const updated = store.updateSettings(newSettings)
    notificationBridge.syncBadgeCount()
    mainWindow.webContents.send('settings:updated', updated)
    return updated
  })

  // Service View Injected Preload Events
  ipcMain.on('service:unread-count', (event, count: number) => {
    const accountId = viewManager.findAccountIdByWebContents(event.sender)
    if (accountId) {
      const safeCount = sanitizeBadgeCount(count)
      notificationBridge.handleUnreadCountUpdate(accountId, safeCount)
    } else {
      console.warn('[Unibox Security] Rejected unread-count event from untrusted WebContents')
    }
  })

  ipcMain.on('service:notification', (event, payload: unknown) => {
    const accountId = viewManager.findAccountIdByWebContents(event.sender)
    if (accountId) {
      const account = store.getAccount(accountId)
      if (account) {
        const sanitized = sanitizeNotificationPayload(payload)
        if (sanitized) {
          notificationBridge.handleNotification({
            accountId,
            serviceId: account.serviceId,
            title: sanitized.title,
            body: sanitized.body,
            icon: sanitized.icon
          })
        }
      }
    } else {
      console.warn('[Unibox Security] Rejected notification event from untrusted WebContents')
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
