import { app, BrowserWindow, Notification } from 'electron'
import { Account, NotificationPayload } from '../shared/types'
import { AppStore } from './store'

export class NotificationBridge {
  private mainWindow: BrowserWindow
  private store: AppStore
  private onAccountFocusRequested?: (accountId: string) => void

  constructor(mainWindow: BrowserWindow, store: AppStore) {
    this.mainWindow = mainWindow
    this.store = store
  }

  public setOnAccountFocusRequested(cb: (accountId: string) => void): void {
    this.onAccountFocusRequested = cb
  }

  /**
   * Handle unread count updates reported by service preload or title observer.
   */
  public handleUnreadCountUpdate(accountId: string, count: number): void {
    const account = this.store.getAccount(accountId)
    if (!account) return

    if (account.unreadCount !== count) {
      this.store.updateAccount(accountId, { unreadCount: count })
      this.syncBadgeCount()
      this.broadcastAccountsUpdated()
    }
  }

  /**
   * Handles title changes and parses unread count using regex.
   */
  public handleTitleUpdate(accountId: string, title: string, regexPattern?: string): void {
    if (!title) return
    const pattern = regexPattern || '[\\(\\[]\\s*(\\d+)\\+?\\s*[\\)\\]]'
    try {
      const regex = new RegExp(pattern)
      const match = title.match(regex)
      const count = match && match[1] ? parseInt(match[1], 10) : 0
      this.handleUnreadCountUpdate(accountId, isNaN(count) ? 0 : count)
    } catch {
      // Fallback
    }
  }

  /**
   * Handles web notification forwarded from service preload script.
   */
  public handleNotification(payload: NotificationPayload): void {
    const settings = this.store.getSettings()
    if (settings.globalMute) return

    const account = this.store.getAccount(payload.accountId)
    if (!account || account.isMuted) return

    if (!Notification.isSupported()) return

    const notification = new Notification({
      title: `${account.label}: ${payload.title}`,
      body: payload.body,
      silent: false
    })

    notification.on('click', () => {
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore()
      }
      this.mainWindow.show()
      this.mainWindow.focus()

      if (this.onAccountFocusRequested) {
        this.onAccountFocusRequested(payload.accountId)
      }
    })

    notification.show()
  }

  /**
   * Sums unread counts across all active, unmuted accounts and sets OS badge.
   */
  public syncBadgeCount(): void {
    const accounts = this.store.getAccounts()
    const totalUnread = accounts.reduce((acc, curr) => {
      return curr.isMuted ? acc : acc + (curr.unreadCount || 0)
    }, 0)

    try {
      if (process.platform === 'darwin' && app.dock) {
        app.dock.setBadge(totalUnread > 0 ? `${totalUnread}` : '')
      } else {
        app.setBadgeCount(totalUnread)
      }
    } catch (err) {
      // Non-fatal if platform does not support badge count
    }
  }

  private broadcastAccountsUpdated(): void {
    if (!this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('accounts:updated', this.store.getAccounts())
    }
  }
}
