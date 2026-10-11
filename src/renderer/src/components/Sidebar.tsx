import React, { useState } from 'react'
import {
  MessageSquare,
  Camera,
  Send,
  Headphones,
  AtSign,
  Mail,
  Plus,
  Settings as SettingsIcon,
  Moon,
  Sun,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  BellOff,
  Power,
  Edit3,
  Trash2,
  Search
} from 'lucide-react'
import { Account, AppSettings, ServiceDefinition, ServiceId } from '@shared/types'
import { SERVICES_CONFIG, SERVICES_LIST } from '@shared/services'

interface SidebarProps {
  accounts: Account[]
  activeAccountId: string | null
  settings: AppSettings
  onSelectAccount: (id: string) => void
  onOpenAddModal: (serviceId?: ServiceId) => void
  onOpenEditModal: (account: Account) => void
  onOpenSettings: () => void
  onOpenQuickSwitcher: () => void
  onToggleTheme: () => void
  onToggleSidebar: () => void
  onDeleteAccount: (id: string) => void
  onToggleMute: (account: Account) => void
  onToggleHibernate: (account: Account) => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  accounts,
  activeAccountId,
  settings,
  onSelectAccount,
  onOpenAddModal,
  onOpenEditModal,
  onOpenSettings,
  onOpenQuickSwitcher,
  onToggleTheme,
  onToggleSidebar,
  onDeleteAccount,
  onToggleMute,
  onToggleHibernate
}) => {
  const [collapsedServices, setCollapsedServices] = useState<Record<string, boolean>>({})

  const toggleServiceCollapse = (serviceId: string) => {
    setCollapsedServices((prev) => ({
      ...prev,
      [serviceId]: !prev[serviceId]
    }))
  }

  const renderServiceIcon = (iconName: string, color?: string, size = 18) => {
    const props = { size, color: color || 'currentColor' }
    switch (iconName) {
      case 'MessageSquare':
        return <MessageSquare {...props} />
      case 'Camera':
        return <Camera {...props} />
      case 'Send':
        return <Send {...props} />
      case 'Headphones':
        return <Headphones {...props} />
      case 'AtSign':
        return <AtSign {...props} />
      case 'Mail':
        return <Mail {...props} />
      default:
        return <MessageSquare {...props} />
    }
  }

  // Group accounts by service
  const accountsByService = SERVICES_LIST.map((service) => {
    const svcAccounts = accounts.filter((a) => a.serviceId === service.id)
    const totalUnread = svcAccounts.reduce((acc, curr) => acc + (curr.isMuted ? 0 : curr.unreadCount), 0)
    return {
      service,
      accounts: svcAccounts,
      totalUnread
    }
  })

  // Global index for shortcuts (1..9)
  const allAccountsOrdered = [...accounts].sort((a, b) => a.order - b.order)

  return (
    <aside className={`sidebar ${settings.sidebarCollapsed ? 'collapsed' : ''}`}>
      {/* Header */}
      <div className="sidebar-header">
        <div className="logo-area">
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              backgroundColor: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 800,
              fontSize: '0.85rem'
            }}
          >
            U
          </div>
          {!settings.sidebarCollapsed && <span>Unibox</span>}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className="btn-icon"
            title="Quick Switcher (Ctrl/Cmd+K)"
            onClick={onOpenQuickSwitcher}
          >
            <Search size={16} />
          </button>
          <button
            className="btn-icon"
            title={settings.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={onToggleSidebar}
          >
            {settings.sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </div>

      {/* Services and Accounts List */}
      <div className="sidebar-content">
        {accountsByService.map(({ service, accounts: svcAccounts, totalUnread }) => {
          const isCollapsed = !!collapsedServices[service.id]

          if (settings.sidebarCollapsed) {
            // Collapsed sidebar mode: compact icon view
            const hasActive = svcAccounts.some((a) => a.id === activeAccountId)
            return (
              <div
                key={service.id}
                className={`account-item ${hasActive ? 'active' : ''}`}
                style={{ position: 'relative' }}
                onClick={() => {
                  if (svcAccounts.length > 0) {
                    onSelectAccount(svcAccounts[0].id)
                  } else {
                    onOpenAddModal(service.id)
                  }
                }}
                title={`${service.name} (${svcAccounts.length} accounts)`}
              >
                {renderServiceIcon(service.icon, service.themeColor, 20)}
                {totalUnread > 0 && (
                  <span
                    className="badge-count"
                    style={{ position: 'absolute', top: 2, right: 2, fontSize: '0.65rem' }}
                  >
                    {totalUnread}
                  </span>
                )}
              </div>
            )
          }

          return (
            <div key={service.id} className="service-group">
              <div
                className="service-header"
                onClick={() => toggleServiceCollapse(service.id)}
              >
                <div className="service-title">
                  {renderServiceIcon(service.icon, service.themeColor, 15)}
                  <span>{service.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {totalUnread > 0 && <span className="badge-count">{totalUnread}</span>}
                  <button
                    className="btn-icon"
                    style={{ width: 20, height: 20 }}
                    title={`Add ${service.name} account`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenAddModal(service.id)
                    }}
                  >
                    <Plus size={14} />
                  </button>
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </div>
              </div>

              {!isCollapsed && (
                <div>
                  {svcAccounts.length === 0 ? (
                    <div
                      style={{
                        padding: '6px 12px 6px 32px',
                        fontSize: '0.78rem',
                        color: 'var(--text-dim)',
                        cursor: 'pointer'
                      }}
                      onClick={() => onOpenAddModal(service.id)}
                    >
                      + Add account
                    </div>
                  ) : (
                    svcAccounts.map((account) => {
                      const isActive = account.id === activeAccountId
                      const indexInAll = allAccountsOrdered.findIndex((a) => a.id === account.id)
                      const shortcutNumber = indexInAll >= 0 && indexInAll < 9 ? indexInAll + 1 : null

                      return (
                        <div
                          key={account.id}
                          className={`account-item ${isActive ? 'active' : ''}`}
                          onClick={() => onSelectAccount(account.id)}
                        >
                          <div className="account-label-container">
                            <span
                              className="account-color-dot"
                              style={{ backgroundColor: account.color }}
                            />
                            <span
                              style={{
                                opacity: account.isHibernated ? 0.5 : 1,
                                fontStyle: account.isHibernated ? 'italic' : 'normal'
                              }}
                            >
                              {account.label}
                            </span>
                            {account.isMuted && (
                              <span title="Muted">
                                <BellOff size={12} color="var(--text-dim)" />
                              </span>
                            )}
                            {account.isHibernated && (
                              <span title="Hibernated">
                                <Power size={12} color="var(--text-dim)" />
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {!account.isMuted && account.unreadCount > 0 && (
                              <span className="badge-count">{account.unreadCount}</span>
                            )}
                            {shortcutNumber && (
                              <span className="shortcut-indicator">⌘{shortcutNumber}</span>
                            )}
                            {/* Actions on hover */}
                            <div
                              className="account-actions"
                              style={{ display: 'inline-flex', gap: 2 }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                className="btn-icon"
                                style={{ width: 22, height: 22 }}
                                title="Edit account"
                                onClick={() => onOpenEditModal(account)}
                              >
                                <Edit3 size={12} />
                              </button>
                              <button
                                className="btn-icon"
                                style={{ width: 22, height: 22 }}
                                title="Delete account"
                                onClick={() => onDeleteAccount(account.id)}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <button
          className="btn-icon"
          title={`Switch to ${settings.theme === 'dark' ? 'Light' : 'Dark'} theme`}
          onClick={onToggleTheme}
        >
          {settings.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <button
          className="btn-secondary"
          style={{ padding: '6px 12px', fontSize: '0.82rem', flex: 1 }}
          onClick={() => onOpenAddModal()}
        >
          <Plus size={14} style={{ marginRight: 4 }} />
          {!settings.sidebarCollapsed && 'Add Account'}
        </button>
        <button className="btn-icon" title="Settings" onClick={onOpenSettings}>
          <SettingsIcon size={17} />
        </button>
      </div>
    </aside>
  )
}
