import { session, Session, WebContents } from 'electron'
import { Account, ServiceDefinition } from '../shared/types'
import { DEFAULT_USER_AGENT, SERVICES_CONFIG } from '../shared/services'
import { isUrlAllowed, safeOpenExternal } from './security'

export class SessionManager {
  private static instance: SessionManager
  private sessions = new Map<string, Session>()

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager()
    }
    return SessionManager.instance
  }

  /**
   * Returns a persistent, isolated session for an account.
   */
  public getOrCreateSession(account: Account): Session {
    const partition = `persist:${account.serviceId}-${account.id}`

    if (this.sessions.has(partition)) {
      return this.sessions.get(partition)!
    }

    const ses = session.fromPartition(partition)
    const service = SERVICES_CONFIG[account.serviceId]

    // Set clean Desktop User-Agent
    const userAgent = account.customUserAgent || service?.defaultUserAgent || DEFAULT_USER_AGENT
    ses.setUserAgent(userAgent)

    // Strict Permission Handler
    this.configurePermissions(ses, service)

    this.sessions.set(partition, ses)
    return ses
  }

  /**
   * Cleans up in-memory session reference and wipes all persistent
   * on-disk data (cookies, localStorage, indexedDB, cache, credentials).
   */
  public async eraseSession(account: Account): Promise<void> {
    const partition = `persist:${account.serviceId}-${account.id}`
    const ses = this.sessions.get(partition) || session.fromPartition(partition)

    try {
      await ses.clearStorageData({
        storages: [
          'cookies',
          'filesystem',
          'indexdb',
          'localstorage',
          'shadercache',
          'serviceworkers',
          'cachestorage'
        ]
      })
      await ses.clearCache()
      await ses.clearHostResolverCache()
      await ses.clearAuthCache()
      console.log(`[Unibox Session] Storage and cache erased successfully for ${partition}`)
    } catch (err) {
      console.error(`[Unibox Session] Failed to erase storage for ${partition}:`, err)
    } finally {
      this.sessions.delete(partition)
    }
  }

  /**
   * Synchronous removeSession for backward compatibility
   */
  public removeSession(account: Account): void {
    this.eraseSession(account).catch((err) => {
      console.error('[Unibox Session] Error in removeSession:', err)
    })
  }

  /**
   * Applies security policies, link interception and navigation allowlisting to a WebContents.
   */
  public attachSecurityHandlers(webContents: WebContents, account: Account): void {
    const service = SERVICES_CONFIG[account.serviceId]

    // 1. Top-level user navigation
    webContents.on('will-navigate', (event, targetUrl) => {
      if (!isUrlAllowed(targetUrl, service)) {
        event.preventDefault()
        console.log(`[Unibox Security] Blocked navigation to ${targetUrl}, opening externally.`)
        safeOpenExternal(targetUrl)
      }
    })

    // 2. Server-side redirect navigation
    webContents.on('will-redirect', (event, targetUrl) => {
      if (!isUrlAllowed(targetUrl, service)) {
        event.preventDefault()
        console.log(`[Unibox Security] Blocked redirect to ${targetUrl}, opening externally.`)
        safeOpenExternal(targetUrl)
      }
    })

    // 3. Subframe navigation guard
    webContents.on('will-frame-navigate', (event) => {
      // Main frame navigation is handled by will-navigate / will-redirect
      if (event.isMainFrame) return
      if (!isUrlAllowed(event.url, service)) {
        event.preventDefault()
        console.warn(`[Unibox Security] Blocked subframe navigation to ${event.url}`)
      }
    })

    // 4. New window / popup interception
    webContents.setWindowOpenHandler(({ url }) => {
      if (isUrlAllowed(url, service)) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            autoHideMenuBar: true,
            webPreferences: {
              sandbox: true,
              contextIsolation: true,
              nodeIntegration: false
            }
          }
        }
      }

      // External link clicked in chat -> open default OS browser safely
      safeOpenExternal(url)
      return { action: 'deny' }
    })

    // 5. Ensure any allowed child windows also inherit security handlers
    webContents.on('did-create-window', (childWindow) => {
      this.attachSecurityHandlers(childWindow.webContents, account)
    })
  }

  private configurePermissions(ses: Session, service?: ServiceDefinition): void {
    // Permission request handler
    ses.setPermissionRequestHandler((_webContents, permission, callback, details) => {
      // Require request from main frame
      if (details.isMainFrame === false) {
        callback(false)
        return
      }

      const requestingUrl = details.requestingUrl || ''
      const isAllowedOrigin = service ? isUrlAllowed(requestingUrl, service) : false

      if (!isAllowedOrigin) {
        callback(false)
        return
      }

      // Whitelisted permissions for messaging & calling
      if (
        permission === 'media' ||
        permission === 'fullscreen' ||
        permission === 'pointerLock'
      ) {
        callback(true)
        return
      }

      // Deny direct HTML5 notifications here because Unibox intercepts notifications
      // in the service preload and delivers them through its managed NotificationBridge
      // with sound, badge, muting, and click routing. Denying here prevents duplicate OS alerts.
      // Deny location, sensors, background sync, etc.
      callback(false)
    })

    // Permission check handler
    ses.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
      const isAllowedOrigin = service ? isUrlAllowed(requestingOrigin, service) : false
      if (!isAllowedOrigin) return false

      return (
        permission === 'media' ||
        permission === 'fullscreen' ||
        permission === 'pointerLock'
      )
    })
  }

  /**
   * Public exposure of URL validator for testing and external audits
   */
  public isUrlAllowed(urlStr: string, service?: ServiceDefinition): boolean {
    return isUrlAllowed(urlStr, service)
  }
}
