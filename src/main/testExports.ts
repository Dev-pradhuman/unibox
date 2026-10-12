/**
 * Production Module Exports
 * Compiled bundle entry that exports production classes and utilities
 * for testing and headless verification without application startup side-effects.
 */

export { AppStore } from './store'
export { SessionManager } from './sessionManager'
export { NotificationBridge } from './notificationBridge'
export { ViewManager } from './viewManager'
export { registerIpcHandlers } from './ipc'
export {
  isUrlAllowed,
  safeOpenExternal,
  assertTrustedRenderer,
  sanitizeBadgeCount,
  sanitizeNotificationPayload,
  parseUnreadFromTitle
} from './security'
export { SERVICES_CONFIG, SERVICES_LIST } from '../shared/services'
