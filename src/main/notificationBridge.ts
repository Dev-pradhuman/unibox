import { app, BrowserWindow, Notification } from 'electron'
import { Account, NotificationPayload } from '../shared/types'
import { AppStore } from './store'
import {
  parseUnreadFromTitle,
  sanitizeBadgeCount,
  sanitizeNotificationPayload
} from './security'

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
    const safeCount = sanitizeBadgeCount(count)
    const account = this.store.getAccount(accountId)
    if (!account) return

    if (account.unreadCount !== safeCount) {
      this.store.updateAccount(accountId, { unreadCount: safeCount })
      this.syncBadgeCount()
      this.broadcastAccountsUpdated()
    }
  }

  /**
   * Handles title changes and parses unread count using robust parser.
   */
  public handleTitleUpdate(accountId: string, title: string, regexPattern?: string): void {
    if (!title) return
    const count = parseUnreadFromTitle(title, regexPattern)
    this.handleUnreadCountUpdate(accountId, count)
  }

  /**
   * Evaluates if a notification should be delivered based on account muting,
   * global muting, and payload sanity.
   */
  public shouldDeliverNotification(payload: NotificationPayload): boolean {
    const settings = this.store.getSettings()
    if (settings.globalMute) return false

    const account = this.store.getAccount(payload.accountId)
    if (!account || account.isMuted) return false

    const sanitized = sanitizeNotificationPayload(payload)
    return sanitized !== null
  }

  /**
   * Handles web notification forwarded from service preload script.
   */
  public handleNotification(rawPayload: NotificationPayload): void {
    if (!this.shouldDeliverNotification(rawPayload)) return

    const account = this.store.getAccount(rawPayload.accountId)
    if (!account) return

    const sanitized = sanitizeNotificationPayload(rawPayload)
    if (!sanitized) return

    if (!Notification.isSupported()) return

    const notification = new Notification({
      title: `${account.label}: ${sanitized.title}`,
      body: sanitized.body,
      silent: false
    })

    notification.on('click', () => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        if (this.mainWindow.isMinimized()) {
          this.mainWindow.restore()
        }
        this.mainWindow.show()
        this.mainWindow.focus()
      }

      if (this.onAccountFocusRequested) {
        this.onAccountFocusRequested(rawPayload.accountId)
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
      } else if (app.setBadgeCount) {
        app.setBadgeCount(totalUnread)
      }
    } catch {
      // Non-fatal if platform does not support badge count
    }
  }

  private broadcastAccountsUpdated(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('accounts:updated', this.store.getAccounts())
    }
  }
}
