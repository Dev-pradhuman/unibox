import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Account,
  AccountCreateInput,
  AccountUpdateInput,
  AppSettings,
  NavigationState,
  ServiceId
} from '@shared/types'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { AccountModal } from './components/AccountModal'
import { SettingsModal } from './components/SettingsModal'
import { QuickSwitcher } from './components/QuickSwitcher'
import { EmptyState } from './components/EmptyState'

export const App: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null)
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'dark',
    sidebarCollapsed: false,
    globalMute: false,
    startMinimized: false,
    openAtLogin: false
  })
  const [navState, setNavState] = useState<NavigationState | null>(null)

  // Modals
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false)
  const [accountToEdit, setAccountToEdit] = useState<Account | null>(null)
  const [initialServiceId, setInitialServiceId] = useState<ServiceId | undefined>(undefined)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isQuickSwitcherOpen, setIsQuickSwitcherOpen] = useState(false)

  const viewPlaceholderRef = useRef<HTMLDivElement>(null)

  // Sync view bounds with Main process
  const updateBounds = useCallback(() => {
    if (viewPlaceholderRef.current && window.unibox) {
      const rect = viewPlaceholderRef.current.getBoundingClientRect()
      window.unibox.updateViewBounds({
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      })
    }
  }, [])

  // Initial load & subscriptions
  useEffect(() => {
    if (!window.unibox) return

    window.unibox.getAccounts().then(setAccounts)
    window.unibox.getActiveAccountId().then(setActiveAccountId)
    window.unibox.getSettings().then(setSettings)

    const unsubAccounts = window.unibox.onAccountsUpdated((updated) => {
      setAccounts(updated)
    })

    const unsubActive = window.unibox.onActiveAccountChanged((id) => {
      setActiveAccountId(id)
    })

    const unsubSettings = window.unibox.onSettingsUpdated((updated) => {
      setSettings(updated)
    })

    const unsubQuick = window.unibox.onTriggerQuickSwitcher(() => {
      setIsQuickSwitcherOpen((prev) => !prev)
    })

    const unsubNav = window.unibox.onNavigationStateChanged((state) => {
      setNavState(state)
    })

    return () => {
      unsubAccounts()
      unsubActive()
      unsubSettings()
      unsubQuick()
      unsubNav()
    }
  }, [])

  // Update bounds on resize or sidebar collapse change
  useEffect(() => {
    updateBounds()
    window.addEventListener('resize', updateBounds)
    return () => window.removeEventListener('resize', updateBounds)
  }, [settings.sidebarCollapsed, updateBounds])

  const isAnyModalOpen = isAccountModalOpen || isSettingsOpen || isQuickSwitcherOpen

  // Hide WebContentsView when modal is open so modal is visible and interactive
  useEffect(() => {
    if (window.unibox?.setViewsVisible) {
      window.unibox.setViewsVisible(!isAnyModalOpen)
    }
  }, [isAnyModalOpen])

  // Apply theme to document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme)
  }, [settings.theme])

  // Select account
  const handleSelectAccount = (id: string) => {
    if (window.unibox) {
      window.unibox.selectAccount(id)
    }
  }

  // Account creation / update
  const handleSaveAccount = async (data: AccountCreateInput | AccountUpdateInput) => {
    if (!window.unibox) return
    if ('id' in data) {
      await window.unibox.updateAccount(data)
    } else {
      const created = await window.unibox.addAccount(data)
      if (created && created.id) {
        await window.unibox.selectAccount(created.id)
      }
    }
  }

  // Delete account
  const handleDeleteAccount = async (id: string) => {
    if (window.unibox && confirm('Are you sure you want to remove this account?')) {
      await window.unibox.removeAccount(id)
    }
  }

  // Toggle Mute
  const handleToggleMute = async (account: Account) => {
    if (window.unibox) {
      await window.unibox.updateAccount({
        id: account.id,
        isMuted: !account.isMuted
      })
    }
  }

  // Toggle Hibernate
  const handleToggleHibernate = async (account: Account) => {
    if (window.unibox) {
      if (account.isHibernated) {
        await window.unibox.wakeAccount(account.id)
      } else {
        await window.unibox.hibernateAccount(account.id)
      }
    }
  }

  // Theme toggle
  const handleToggleTheme = () => {
    const nextTheme = settings.theme === 'dark' ? 'light' : 'dark'
    if (window.unibox) {
      window.unibox.updateSettings({ theme: nextTheme })
    }
  }

  // Sidebar toggle
  const handleToggleSidebar = () => {
    if (window.unibox) {
      window.unibox.updateSettings({ sidebarCollapsed: !settings.sidebarCollapsed })
    }
  }

  const activeAccount = accounts.find((a) => a.id === activeAccountId) || null

  return (
    <div className="app-container">
      {/* Left Sidebar */}
      <Sidebar
        accounts={accounts}
        activeAccountId={activeAccountId}
        settings={settings}
        onSelectAccount={handleSelectAccount}
        onOpenAddModal={(svcId) => {
          setAccountToEdit(null)
          setInitialServiceId(svcId)
          setIsAccountModalOpen(true)
        }}
        onOpenEditModal={(acc) => {
          setAccountToEdit(acc)
          setInitialServiceId(acc.serviceId)
          setIsAccountModalOpen(true)
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenQuickSwitcher={() => setIsQuickSwitcherOpen(true)}
        onToggleTheme={handleToggleTheme}
        onToggleSidebar={handleToggleSidebar}
        onDeleteAccount={handleDeleteAccount}
        onToggleMute={handleToggleMute}
        onToggleHibernate={handleToggleHibernate}
      />

      {/* Main Area */}
      <main className="main-area">
        <Header
          activeAccount={activeAccount}
          navState={navState}
          onBack={() => activeAccountId && window.unibox?.navigateBack(activeAccountId)}
          onForward={() => activeAccountId && window.unibox?.navigateForward(activeAccountId)}
          onReload={() => activeAccountId && window.unibox?.reloadAccount(activeAccountId)}
          onToggleMute={handleToggleMute}
          onToggleHibernate={handleToggleHibernate}
          onOpenQuickSwitcher={() => setIsQuickSwitcherOpen(true)}
        />

        {/* Web View Placeholder */}
        <div
          ref={viewPlaceholderRef}
          className="web-view-placeholder"
          style={{ visibility: activeAccount ? 'visible' : 'hidden' }}
        />

        {/* Empty state when no account is active */}
        {!activeAccount && (
          <div style={{ position: 'absolute', inset: '52px 0 0 0', zIndex: 1 }}>
            <EmptyState
              onAddAccount={(svcId) => {
                setAccountToEdit(null)
                setInitialServiceId(svcId)
                setIsAccountModalOpen(true)
              }}
            />
          </div>
        )}
      </main>

      {/* Modals */}
      <AccountModal
        isOpen={isAccountModalOpen}
        accountToEdit={accountToEdit}
        initialServiceId={initialServiceId}
        onClose={() => setIsAccountModalOpen(false)}
        onSave={handleSaveAccount}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        onClose={() => setIsSettingsOpen(false)}
        onUpdateSettings={(updated) => window.unibox?.updateSettings(updated)}
      />

      <QuickSwitcher
        isOpen={isQuickSwitcherOpen}
        accounts={accounts}
        onClose={() => setIsQuickSwitcherOpen(false)}
        onSelectAccount={handleSelectAccount}
      />
    </div>
  )
}
