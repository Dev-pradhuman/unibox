import { ipcRenderer } from 'electron'

/**
 * Service Preload Script
 * Injected into each isolated WebContentsView session.
 * 1. Bridges document.title mutations to extract unread badge counts.
 * 2. Overrides the web Notification API to forward notifications to the native host.
 */

// Track last reported count to avoid redundant IPC noise
let lastReportedCount = 0

function parseUnreadCountFromTitle(title: string): number {
  if (!title) return 0

  // Matches common patterns like "(3) WhatsApp", "[2] Discord", "(99+) Telegram"
  const match = title.match(/[\(\[]\s*(\d+)\+?\s*[\)\]]/)
  if (match && match[1]) {
    const parsed = parseInt(match[1], 10)
    return isNaN(parsed) ? 0 : parsed
  }

  // Matches leading bullet indicator like "• Discord" (unread indicator)
  if (/^[•●]/.test(title.trim())) {
    return 1
  }

  return 0
}

function checkAndReportUnreadCount() {
  try {
    const count = parseUnreadCountFromTitle(document.title)
    if (count !== lastReportedCount) {
      lastReportedCount = count
      ipcRenderer.send('service:unread-count', count)
    }
  } catch (err) {
    // Silently handle any access error
  }
}

// 1. Observe title changes
function initTitleObserver() {
  checkAndReportUnreadCount()

  const titleElement = document.querySelector('title')
  if (titleElement) {
    const observer = new MutationObserver(() => {
      checkAndReportUnreadCount()
    })
    observer.observe(titleElement, {
      subtree: true,
      characterData: true,
      childList: true
    })
  }

  // Fallback periodic check in case title mutations bypass DOM observer
  setInterval(checkAndReportUnreadCount, 2000)
}

// 2. Intercept native Notification constructor
function initNotificationProxy() {
  try {
    const NativeNotification = (window as any).Notification

    class UniboxNotification extends EventTarget {
      static permission: NotificationPermission = 'granted'

      static requestPermission(
        callback?: (permission: NotificationPermission) => void
      ): Promise<NotificationPermission> {
        if (callback) callback('granted')
        return Promise.resolve('granted')
      }

      constructor(title: string, options: NotificationOptions = {}) {
        super()
        ipcRenderer.send('service:notification', {
          title,
          body: options.body || '',
          icon: options.icon
        })
      }

      close() {}
    }

    // Preserve static properties if any
    if (NativeNotification) {
      Object.defineProperty(UniboxNotification, 'maxActions', {
        value: NativeNotification.maxActions || 2
      })
    }

    ;(window as any).Notification = UniboxNotification
  } catch (err) {
    console.warn('[Unibox] Failed to patch Notification constructor:', err)
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initTitleObserver()
    initNotificationProxy()
  })
} else {
  initTitleObserver()
  initNotificationProxy()
}
