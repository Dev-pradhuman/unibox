import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { Account, AppSettings, AppState } from '../shared/types'

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  sidebarCollapsed: false,
  globalMute: false,
  startMinimized: false,
  openAtLogin: false
}

export class AppStore {
  private filePath: string
  private state: AppState

  constructor(customFilePath?: string) {
    if (customFilePath) {
      this.filePath = customFilePath
    } else {
      const userData = app.getPath('userData')
      this.filePath = path.join(userData, 'unibox_data.json')
    }
    this.state = this.load()
  }

  private load(): AppState {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8')
        const parsed = JSON.parse(raw)
        return {
          accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
          activeAccountId: typeof parsed.activeAccountId === 'string' ? parsed.activeAccountId : null,
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) }
        }
      }
    } catch (err) {
      console.warn('[Unibox Store] Error reading store, initializing fallback:', err)
    }

    return {
      accounts: [],
      activeAccountId: null,
      settings: DEFAULT_SETTINGS
    }
  }

  private persist(): void {
    try {
      const dir = path.dirname(this.filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      const tempPath = `${this.filePath}.tmp.${Date.now()}`
      fs.writeFileSync(tempPath, JSON.stringify(this.state, null, 2), 'utf-8')
      fs.renameSync(tempPath, this.filePath)
    } catch (err) {
      console.error('[Unibox Store] Failed to persist data:', err)
    }
  }

  public getState(): AppState {
    return this.state
  }

  public getAccounts(): Account[] {
    return [...this.state.accounts].sort((a, b) => a.order - b.order)
  }

  public getAccount(id: string): Account | undefined {
    return this.state.accounts.find((acc) => acc.id === id)
  }

  public addAccount(account: Account): Account {
    this.state.accounts.push(account)
    this.state.activeAccountId = account.id
    this.persist()
    return account
  }

  public updateAccount(id: string, updates: Partial<Account>): Account | null {
    const index = this.state.accounts.findIndex((acc) => acc.id === id)
    if (index === -1) return null
    this.state.accounts[index] = {
      ...this.state.accounts[index],
      ...updates
    }
    this.persist()
    return this.state.accounts[index]
  }

  public removeAccount(id: string): boolean {
    const initialLen = this.state.accounts.length
    this.state.accounts = this.state.accounts.filter((acc) => acc.id !== id)
    if (this.state.activeAccountId === id) {
      this.state.activeAccountId = this.state.accounts[0]?.id || null
    }
    this.persist()
    return this.state.accounts.length < initialLen
  }

  public reorderAccounts(accountIds: string[]): Account[] {
    const accountMap = new Map(this.state.accounts.map((a) => [a.id, a]))
    const newAccounts: Account[] = []

    accountIds.forEach((id, index) => {
      const acc = accountMap.get(id)
      if (acc) {
        acc.order = index
        newAccounts.push(acc)
        accountMap.delete(id)
      }
    })

    // Append any missing accounts
    accountMap.forEach((acc) => {
      acc.order = newAccounts.length
      newAccounts.push(acc)
    })

    this.state.accounts = newAccounts
    this.persist()
    return this.getAccounts()
  }

  public getActiveAccountId(): string | null {
    return this.state.activeAccountId
  }

  public setActiveAccountId(id: string | null): void {
    this.state.activeAccountId = id
    this.persist()
  }

  public getSettings(): AppSettings {
    return { ...this.state.settings }
  }

  public updateSettings(settings: Partial<AppSettings>): AppSettings {
    this.state.settings = {
      ...this.state.settings,
      ...settings
    }
    this.persist()
    return this.getSettings()
  }
}
