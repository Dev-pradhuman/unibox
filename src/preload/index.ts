import { contextBridge, ipcRenderer } from 'electron'
import {
  Account,
  AccountCreateInput,
  AccountUpdateInput,
  AppSettings,
  NavigationState,
  ViewBounds
} from '../shared/types'

export interface UniboxApi {
  // Accounts
  getAccounts: () => Promise<Account[]>
  addAccount: (input: AccountCreateInput) => Promise<Account>
  updateAccount: (input: AccountUpdateInput) => Promise<Account>
  removeAccount: (id: string) => Promise<boolean>
  reorderAccounts: (accountIds: string[]) => Promise<Account[]>
  selectAccount: (id: string | null) => Promise<void>
  getActiveAccountId: () => Promise<string | null>

  // Navigation and view controls
  updateViewBounds: (bounds: ViewBounds) => Promise<void>
  setViewsVisible: (visible: boolean) => Promise<void>
  reloadAccount: (id: string) => Promise<void>
  navigateBack: (id: string) => Promise<void>
  navigateForward: (id: string) => Promise<void>
  hibernateAccount: (id: string) => Promise<void>
  wakeAccount: (id: string) => Promise<void>

  // Settings
  getSettings: () => Promise<AppSettings>
  updateSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>

  // Subscriptions
  onAccountsUpdated: (callback: (accounts: Account[]) => void) => () => void
  onActiveAccountChanged: (callback: (accountId: string | null) => void) => () => void
  onSettingsUpdated: (callback: (settings: AppSettings) => void) => () => void
  onTriggerQuickSwitcher: (callback: () => void) => () => void
  onNavigationStateChanged: (callback: (state: NavigationState) => void) => () => void
}

const api: UniboxApi = {
  getAccounts: () => ipcRenderer.invoke('accounts:get-all'),
  addAccount: (input) => ipcRenderer.invoke('accounts:add', input),
  updateAccount: (input) => ipcRenderer.invoke('accounts:update', input),
  removeAccount: (id) => ipcRenderer.invoke('accounts:remove', id),
  reorderAccounts: (ids) => ipcRenderer.invoke('accounts:reorder', ids),
  selectAccount: (id) => ipcRenderer.invoke('view:select-account', id),
  getActiveAccountId: () => ipcRenderer.invoke('view:get-active-account'),

  updateViewBounds: (bounds) => ipcRenderer.invoke('view:update-bounds', bounds),
  setViewsVisible: (visible) => ipcRenderer.invoke('view:set-visible', visible),
  reloadAccount: (id) => ipcRenderer.invoke('view:reload', id),
  navigateBack: (id) => ipcRenderer.invoke('view:go-back', id),
  navigateForward: (id) => ipcRenderer.invoke('view:go-forward', id),
  hibernateAccount: (id) => ipcRenderer.invoke('view:hibernate', id),
  wakeAccount: (id) => ipcRenderer.invoke('view:wake', id),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings),

  onAccountsUpdated: (callback) => {
    const listener = (_: any, accounts: Account[]) => callback(accounts)
    ipcRenderer.on('accounts:updated', listener)
    return () => ipcRenderer.removeListener('accounts:updated', listener)
  },
  onActiveAccountChanged: (callback) => {
    const listener = (_: any, accountId: string | null) => callback(accountId)
    ipcRenderer.on('view:active-changed', listener)
    return () => ipcRenderer.removeListener('view:active-changed', listener)
  },
  onSettingsUpdated: (callback) => {
    const listener = (_: any, settings: AppSettings) => callback(settings)
    ipcRenderer.on('settings:updated', listener)
    return () => ipcRenderer.removeListener('settings:updated', listener)
  },
  onTriggerQuickSwitcher: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('shortcut:quick-switcher', listener)
    return () => ipcRenderer.removeListener('shortcut:quick-switcher', listener)
  },
  onNavigationStateChanged: (callback) => {
    const listener = (_: any, state: NavigationState) => callback(state)
    ipcRenderer.on('view:nav-state', listener)
    return () => ipcRenderer.removeListener('view:nav-state', listener)
  }
}

contextBridge.exposeInMainWorld('unibox', api)
