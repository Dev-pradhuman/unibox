import { BrowserWindow, IpcMainInvokeEvent, shell, WebContents } from 'electron'
import { is } from '@electron-toolkit/utils'
import { ServiceDefinition } from '../shared/types'

/**
 * Strict URL and Navigation Validator
 * Enforces HTTPS only (with narrowly scoped about:blank support for initialization),
 * rejects data:, javascript:, file:, and arbitrary protocol schemes,
 * and validates strict subdomain boundaries.
 */
export function isUrlAllowed(urlStr: string, service?: ServiceDefinition): boolean {
  if (!service || !urlStr) return false

  try {
    const parsed = new URL(urlStr)

    // Allow strictly about:blank for initial blank frames
    if (parsed.protocol === 'about:') {
      return parsed.pathname === 'blank' || parsed.href === 'about:blank'
    }

    // Strictly require HTTPS - reject plain HTTP, data:, javascript:, file:, etc.
    if (parsed.protocol !== 'https:') {
      return false
    }

    const hostname = parsed.hostname.toLowerCase()

    return service.allowedDomains.some((domain) => {
      const lowerDomain = domain.toLowerCase()
      // Exact match or strict dot-separated subdomain
      return hostname === lowerDomain || hostname.endsWith(`.${lowerDomain}`)
    })
  } catch {
    return false
  }
}

/**
 * Safe shell.openExternal wrapper
 * Prevents OS command injection and dangerous protocol handling.
 * Strictly permits only https: and http: protocols.
 */
export async function safeOpenExternal(targetUrl: string): Promise<boolean> {
  if (!targetUrl || typeof targetUrl !== 'string') {
    console.warn('[Unibox Security] Blocked invalid openExternal target:', targetUrl)
    return false
  }

  try {
    const parsed = new URL(targetUrl)

    // Strictly permit only web protocols
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      console.warn(
        `[Unibox Security] Blocked dangerous protocol execution: ${parsed.protocol} (${targetUrl})`
      )
      return false
    }

    await shell.openExternal(parsed.href)
    return true
  } catch (err) {
    console.error('[Unibox Security] Failed to open external URL:', err)
    return false
  }
}

/**
 * Validates that an IPC message originated from the trusted application UI renderer
 * and not from an untrusted service WebContents or third-party iframe.
 */
export function assertTrustedRenderer(
  event: IpcMainInvokeEvent,
  mainWindow: BrowserWindow
): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error('[Unibox Security] Main window is not available')
  }

  // 1. Sender WebContents must be the main window's webContents
  if (event.sender.id !== mainWindow.webContents.id) {
    throw new Error(
      `[Unibox Security] Unauthorized IPC sender: ${event.sender.id} does not match main window`
    )
  }

  // 2. Must originate from the top-level main frame (not an iframe inside renderer)
  if (event.senderFrame !== mainWindow.webContents.mainFrame) {
    throw new Error('[Unibox Security] Unauthorized IPC sender: Message not from main frame')
  }

  // 3. Sender frame URL check
  const senderUrl = event.senderFrame?.url || ''
  const devUrl = process.env['ELECTRON_RENDERER_URL']

  if (is.dev && devUrl) {
    if (!senderUrl.startsWith(devUrl)) {
      throw new Error(`[Unibox Security] Unauthorized dev renderer URL: ${senderUrl}`)
    }
  } else {
    // In production, must be local file:// or app scheme loading the renderer
    if (!senderUrl.startsWith('file://') && !senderUrl.startsWith('app://')) {
      throw new Error(`[Unibox Security] Unauthorized prod renderer URL: ${senderUrl}`)
    }
  }
}

/**
 * Validates and sanitizes unread badge count from untrusted sources
 */
export function sanitizeBadgeCount(count: unknown): number {
  if (typeof count !== 'number' || isNaN(count) || !isFinite(count)) {
    return 0
  }
  const intVal = Math.floor(count)
  if (intVal <= 0) return 0
  return Math.min(intVal, 99999)
}

/**
 * Validates and sanitizes notification payloads from service preloads
 */
export function sanitizeNotificationPayload(
  payload: unknown
): { title: string; body: string; icon?: string } | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const p = payload as Record<string, unknown>
  const title = typeof p.title === 'string' ? p.title.trim().slice(0, 300) : ''
  const body = typeof p.body === 'string' ? p.body.trim().slice(0, 2000) : ''

  if (!title && !body) {
    return null
  }

  let icon: string | undefined
  if (typeof p.icon === 'string' && p.icon.trim()) {
    try {
      const parsed = new URL(p.icon)
      if (parsed.protocol === 'https:' || parsed.protocol === 'data:') {
        icon = p.icon.slice(0, 1000)
      }
    } catch {
      // Ignore invalid icon URL
    }
  }

  return { title, body, icon }
}

/**
 * Robust Unread Badge Extractor from Window / Document Titles
 * Handles standard patterns across all 6 services:
 * - "(3) WhatsApp", "(99+) Telegram", "[4] Discord"
 * - Leading bullet "• Discord" (unread channel indicator)
 * - Service custom regex
 */
export function parseUnreadFromTitle(title: string, customRegex?: string): number {
  if (!title || typeof title !== 'string') return 0

  if (customRegex) {
    try {
      const match = title.match(new RegExp(customRegex))
      if (match && match[1]) {
        const val = parseInt(match[1], 10)
        return isNaN(val) ? 0 : Math.max(0, val)
      }
    } catch {
      // Fallback to standard patterns
    }
  }

  // Matches parenthesized or bracketed numbers with optional trailing plus, e.g. (3), [12], (99+)
  const match = title.match(/[\(\[]\s*(\d+)\+?\s*[\)\]]/)
  if (match && match[1]) {
    const val = parseInt(match[1], 10)
    return isNaN(val) ? 0 : Math.max(0, val)
  }

  // Matches leading bullet indicator like "• Discord" or "● WhatsApp"
  if (/^[•●]/.test(title.trim())) {
    return 1
  }

  return 0
}
