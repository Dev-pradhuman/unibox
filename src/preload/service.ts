import { contextBridge, ipcRenderer, webFrame } from 'electron'

/**
 * Service Preload Script
 * Injected into each isolated WebContentsView session.
 * 1. Bridges document.title mutations to extract unread badge counts.
 * 2. Overrides the web Notification API in the Main World so web apps dispatch
 *    notifications to Unibox via an isolated contextBridge bridge.
 */

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

function checkAndReportUnreadCount(): void {
  try {
    const count = parseUnreadCountFromTitle(document.title)
    if (count !== lastReportedCount) {
      lastReportedCount = count
      ipcRenderer.send('service:unread-count', count)
    }
  } catch {
    // Silently handle any access error
  }
}

// 1. Observe title changes
function initTitleObserver(): void {
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

// 2. Intercept native Notification constructor in Main World
function initNotificationProxy(): void {
  try {
    // Expose a strictly constrained one-way notification bridge in Main World
    contextBridge.exposeInMainWorld('__uniboxPrivateBridge', {
      notify: (payload: { title: string; body: string; icon?: string }) => {
        if (!payload || typeof payload !== 'object') return
        ipcRenderer.send('service:notification', {
          title: typeof payload.title === 'string' ? payload.title.slice(0, 300) : '',
          body: typeof payload.body === 'string' ? payload.body.slice(0, 2000) : '',
          icon: typeof payload.icon === 'string' ? payload.icon.slice(0, 1000) : undefined
        })
      }
    })

    // Inject the Notification constructor replacement into Main World (World ID 0)
    webFrame.executeJavaScript(`
      (() => {
        if (window.__uniboxNotificationPatched) return;
        window.__uniboxNotificationPatched = true;

        class UniboxProxyNotification extends EventTarget {
          static permission = 'granted';
          static get permission() { return 'granted'; }

          static requestPermission(callback) {
            if (typeof callback === 'function') callback('granted');
            return Promise.resolve('granted');
          }

          constructor(title, options = {}) {
            super();
            try {
              if (window.__uniboxPrivateBridge && typeof window.__uniboxPrivateBridge.notify === 'function') {
                window.__uniboxPrivateBridge.notify({
                  title: String(title || ''),
                  body: String(options?.body || ''),
                  icon: typeof options?.icon === 'string' ? options.icon : undefined
                });
              }
            } catch (err) {
              console.warn('[Unibox] Notification dispatch error:', err);
            }
          }

          close() {}
        }

        try {
          Object.defineProperty(window, 'Notification', {
            value: UniboxProxyNotification,
            writable: true,
            configurable: true
          });
        } catch {
          window.Notification = UniboxProxyNotification;
        }
      })();
    `)
  } catch (err) {
    console.warn('[Unibox] Failed to initialize notification proxy:', err)
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
