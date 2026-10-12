import { session, Session, shell, WebContents } from 'electron'
import { Account, ServiceDefinition } from '../shared/types'
import { DEFAULT_USER_AGENT, SERVICES_CONFIG } from '../shared/services'

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

  public removeSession(account: Account): void {
    const partition = `persist:${account.serviceId}-${account.id}`
    this.sessions.delete(partition)
  }

  /**
   * Applies security policies, link interception and navigation whitelisting to a WebContents.
   */
  public attachSecurityHandlers(webContents: WebContents, account: Account): void {
    const service = SERVICES_CONFIG[account.serviceId]

    // 1. Navigation whitelist
    webContents.on('will-navigate', (event, targetUrl) => {
      if (!this.isUrlAllowed(targetUrl, service)) {
        event.preventDefault()
        console.log(`[Unibox Security] Blocked navigation to ${targetUrl}, opening externally.`)
        shell.openExternal(targetUrl).catch((err) => {
          console.error('[Unibox Security] Failed to open external URL:', err)
        })
      }
    })

    // 2. New window / popup interception
    webContents.setWindowOpenHandler(({ url }) => {
      if (this.isUrlAllowed(url, service)) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            autoHideMenuBar: true,
            webPreferences: {
              sandbox: true,
              contextIsolation: true
            }
          }
        }
      }

      // External link clicked in chat -> open default OS browser
      shell.openExternal(url).catch((err) => {
        console.error('[Unibox Security] Failed to open external URL:', err)
      })
      return { action: 'deny' }
    })
  }

  private configurePermissions(ses: Session, service?: ServiceDefinition): void {
    // Permission request handler
    ses.setPermissionRequestHandler((_webContents, permission, callback, details) => {
      const requestingUrl = details.requestingUrl || ''
      const isAllowedOrigin = service ? this.isUrlAllowed(requestingUrl, service) : false

      if (!isAllowedOrigin) {
        callback(false)
        return
      }

      // Whitelisted permissions for messaging
      if (
        permission === 'notifications' ||
        permission === 'media' ||
        permission === 'fullscreen' ||
        permission === 'pointerLock'
      ) {
        callback(true)
        return
      }

      // Deny location, sensors, background sync, etc.
      callback(false)
    })

    // Permission check handler
    ses.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
      const isAllowedOrigin = service ? this.isUrlAllowed(requestingOrigin, service) : false
      if (!isAllowedOrigin) return false

      return (
        permission === 'notifications' ||
        permission === 'media' ||
        permission === 'fullscreen' ||
        permission === 'pointerLock'
      )
    })
  }

  private isUrlAllowed(urlStr: string, service?: ServiceDefinition): boolean {
    if (!service) return false
    try {
      const parsed = new URL(urlStr)
      // Allow about:blank and data urls
      if (parsed.protocol === 'about:' || parsed.protocol === 'data:') {
        return true
      }

      const hostname = parsed.hostname.toLowerCase()
      return service.allowedDomains.some((domain) => {
        const lowerDomain = domain.toLowerCase()
        return hostname === lowerDomain || hostname.endsWith(`.${lowerDomain}`)
      })
    } catch {
      return false
    }
  }
}
