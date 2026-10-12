import { BrowserWindow, WebContentsView } from 'electron'
import * as path from 'path'
import { Account, NavigationState, ViewBounds } from '../shared/types'
import { SERVICES_CONFIG } from '../shared/services'
import { SessionManager } from './sessionManager'
import { NotificationBridge } from './notificationBridge'

export class ViewManager {
  private mainWindow: BrowserWindow
  private sessionManager: SessionManager
  private notificationBridge: NotificationBridge
  private servicePreloadPath: string

  // Map of accountId -> WebContentsView
  private views = new Map<string, WebContentsView>()
  private activeAccountId: string | null = null
  private currentBounds: ViewBounds = { x: 260, y: 52, width: 940, height: 748 }
  private isVisible = true

  constructor(
    mainWindow: BrowserWindow,
    sessionManager: SessionManager,
    notificationBridge: NotificationBridge
  ) {
    this.mainWindow = mainWindow
    this.sessionManager = sessionManager
    this.notificationBridge = notificationBridge
    this.servicePreloadPath = path.join(__dirname, '../preload/service.js')

    // Handle window resize to adjust active view bounds
    this.mainWindow.on('resize', () => {
      this.refreshActiveViewBounds()
    })
  }

  public setBounds(bounds: ViewBounds): void {
    this.currentBounds = bounds
    this.refreshActiveViewBounds()
  }

  public setViewsVisible(visible: boolean): void {
    this.isVisible = visible
    if (!this.activeAccountId) return
    const activeView = this.views.get(this.activeAccountId)
    if (activeView) {
      try {
        activeView.setVisible(visible)
      } catch (err) {
        // Fallback if not supported
      }
      if (!visible) {
        activeView.setBounds({ x: 0, y: 0, width: 0, height: 0 })
      } else {
        activeView.setBounds(this.currentBounds)
      }
    }
  }

  private refreshActiveViewBounds(): void {
    if (!this.activeAccountId) return
    const activeView = this.views.get(this.activeAccountId)
    if (activeView && this.isVisible) {
      activeView.setBounds(this.currentBounds)
    }
  }

  public getOrCreateView(account: Account): WebContentsView {
    if (this.views.has(account.id)) {
      return this.views.get(account.id)!
    }

    const ses = this.sessionManager.getOrCreateSession(account)
    const service = SERVICES_CONFIG[account.serviceId]

    const view = new WebContentsView({
      webPreferences: {
        session: ses,
        preload: this.servicePreloadPath,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: true
      }
    })

    // Attach security and external link handlers
    this.sessionManager.attachSecurityHandlers(view.webContents, account)

    // Fallback title-based unread count detection
    view.webContents.on('page-title-updated', (_event, title) => {
      this.notificationBridge.handleTitleUpdate(account.id, title, service?.titleBadgeRegex)
      this.emitNavigationState(account.id)
    })

    // Navigation state tracking
    view.webContents.on('did-finish-load', () => {
      this.emitNavigationState(account.id)
    })
    view.webContents.on('did-navigate', () => {
      this.emitNavigationState(account.id)
    })
    view.webContents.on('did-navigate-in-page', () => {
      this.emitNavigationState(account.id)
    })

    // Load service URL if not hibernated
    if (!account.isHibernated && service?.url) {
      view.webContents.loadURL(service.url).catch((err) => {
        console.warn(`[Unibox View] Error loading URL for ${account.label}:`, err)
      })
    }

    this.views.set(account.id, view)
    return view
  }

  public selectAccount(account: Account | null): void {
    if (!account) {
      if (this.activeAccountId) {
        const prevView = this.views.get(this.activeAccountId)
        if (prevView) {
          this.mainWindow.contentView.removeChildView(prevView)
        }
      }
      this.activeAccountId = null
      return
    }

    if (this.activeAccountId === account.id) {
      return
    }

    // Detach previous view without destroying it
    if (this.activeAccountId) {
      const prevView = this.views.get(this.activeAccountId)
      if (prevView) {
        this.mainWindow.contentView.removeChildView(prevView)
      }
    }

    this.activeAccountId = account.id

    // If account was hibernated, wake it up
    if (account.isHibernated) {
      this.wakeAccount(account)
      return
    }

    let view = this.views.get(account.id)
    if (!view) {
      view = this.getOrCreateView(account)
    }

    // Attach to window content view if not already attached
    if (!this.mainWindow.contentView.children.includes(view)) {
      this.mainWindow.contentView.addChildView(view)
    }

    try {
      view.setVisible(this.isVisible)
    } catch (err) {}

    if (this.isVisible) {
      view.setBounds(this.currentBounds)
    } else {
      view.setBounds({ x: 0, y: 0, width: 0, height: 0 })
    }

    this.emitNavigationState(account.id)
  }

  public reloadAccount(accountId: string): void {
    const view = this.views.get(accountId)
    if (view) {
      view.webContents.reload()
    }
  }

  public navigateBack(accountId: string): void {
    const view = this.views.get(accountId)
    if (view && view.webContents.canGoBack()) {
      view.webContents.goBack()
    }
  }

  public navigateForward(accountId: string): void {
    const view = this.views.get(accountId)
    if (view && view.webContents.canGoForward()) {
      view.webContents.goForward()
    }
  }

  public hibernateAccount(account: Account): void {
    const view = this.views.get(account.id)
    if (view) {
      if (this.activeAccountId === account.id) {
        this.mainWindow.contentView.removeChildView(view)
        this.activeAccountId = null
      }
      try {
        view.webContents.close()
      } catch (err) {
        // Ignore close error
      }
      this.views.delete(account.id)
    }
  }

  public wakeAccount(account: Account): void {
    const service = SERVICES_CONFIG[account.serviceId]
    const view = this.getOrCreateView(account)

    if (view.webContents.getURL() === '' || view.webContents.getURL() === 'about:blank') {
      if (service?.url) {
        view.webContents.loadURL(service.url).catch(console.error)
      }
    }

    if (this.activeAccountId === account.id) {
      this.mainWindow.contentView.addChildView(view)
      view.setBounds(this.currentBounds)
    }
  }

  public removeAccount(accountId: string): void {
    const view = this.views.get(accountId)
    if (view) {
      if (this.activeAccountId === accountId) {
        this.mainWindow.contentView.removeChildView(view)
        this.activeAccountId = null
      }
      try {
        view.webContents.close()
      } catch (err) {
        // Ignore
      }
      this.views.delete(accountId)
    }
  }

  public findAccountIdByWebContents(webContents: any): string | undefined {
    for (const [accountId, view] of this.views.entries()) {
      if (view.webContents.id === webContents.id) {
        return accountId
      }
    }
    return undefined
  }

  private emitNavigationState(accountId: string): void {
    if (this.activeAccountId !== accountId) return

    const view = this.views.get(accountId)
    if (!view || view.webContents.isDestroyed()) return

    const navHistory = (view.webContents as any).navigationHistory
    const canGoBack = navHistory ? navHistory.canGoBack() : view.webContents.canGoBack()
    const canGoForward = navHistory ? navHistory.canGoForward() : view.webContents.canGoForward()

    const navState: NavigationState = {
      canGoBack,
      canGoForward,
      isLoading: view.webContents.isLoading(),
      currentUrl: view.webContents.getURL()
    }

    if (!this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('view:nav-state', navState)
    }
  }
}
