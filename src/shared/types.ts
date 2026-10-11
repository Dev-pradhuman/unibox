export type ServiceId =
  | 'whatsapp'
  | 'instagram'
  | 'telegram'
  | 'discord'
  | 'threads'
  | 'gmail'

export interface ServiceDefinition {
  id: ServiceId
  name: string
  url: string
  allowedDomains: string[]
  icon: string
  themeColor: string
  titleBadgeRegex?: string
  badgeSelector?: string
  defaultUserAgent?: string
  description?: string
}

export interface Account {
  id: string
  serviceId: ServiceId
  label: string
  color: string
  order: number
  isMuted: boolean
  isHibernated: boolean
  customUserAgent?: string
  unreadCount: number
  createdAt: number
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system'
  sidebarCollapsed: boolean
  globalMute: boolean
  startMinimized: boolean
  openAtLogin: boolean
}

export interface AppState {
  accounts: Account[]
  activeAccountId: string | null
  settings: AppSettings
}

export interface AccountCreateInput {
  serviceId: ServiceId
  label: string
  color?: string
  customUserAgent?: string
}

export interface AccountUpdateInput {
  id: string
  label?: string
  color?: string
  isMuted?: boolean
  isHibernated?: boolean
  customUserAgent?: string
}

export interface NotificationPayload {
  accountId: string
  serviceId: ServiceId
  title: string
  body: string
  icon?: string
}

export interface ViewBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface NavigationState {
  canGoBack: boolean
  canGoForward: boolean
  isLoading: boolean
  currentUrl: string
}
