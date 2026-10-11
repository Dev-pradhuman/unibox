import React from 'react'
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Bell,
  BellOff,
  Power,
  Search,
  ExternalLink
} from 'lucide-react'
import { Account, NavigationState } from '@shared/types'
import { SERVICES_CONFIG } from '@shared/services'

interface HeaderProps {
  activeAccount: Account | null
  navState: NavigationState | null
  onBack: () => void
  onForward: () => void
  onReload: () => void
  onToggleMute: (account: Account) => void
  onToggleHibernate: (account: Account) => void
  onOpenQuickSwitcher: () => void
}

export const Header: React.FC<HeaderProps> = ({
  activeAccount,
  navState,
  onBack,
  onForward,
  onReload,
  onToggleMute,
  onToggleHibernate,
  onOpenQuickSwitcher
}) => {
  const service = activeAccount ? SERVICES_CONFIG[activeAccount.serviceId] : null

  return (
    <header className="top-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          className="btn-icon"
          title="Go back"
          disabled={!navState?.canGoBack}
          onClick={onBack}
          style={{ opacity: navState?.canGoBack ? 1 : 0.4 }}
        >
          <ArrowLeft size={16} />
        </button>
        <button
          className="btn-icon"
          title="Go forward"
          disabled={!navState?.canGoForward}
          onClick={onForward}
          style={{ opacity: navState?.canGoForward ? 1 : 0.4 }}
        >
          <ArrowRight size={16} />
        </button>
        <button
          className="btn-icon"
          title="Reload page"
          onClick={onReload}
          disabled={!activeAccount}
          style={{ opacity: activeAccount ? 1 : 0.4 }}
        >
          <RotateCw size={15} />
        </button>

        {activeAccount && service && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginLeft: 8,
              paddingLeft: 12,
              borderLeft: '1px solid var(--border-color)'
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: activeAccount.color
              }}
            />
            <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>
              {service.name}
            </span>
            <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>•</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              {activeAccount.label}
            </span>
            {activeAccount.unreadCount > 0 && !activeAccount.isMuted && (
              <span className="badge-count" style={{ marginLeft: 4 }}>
                {activeAccount.unreadCount}
              </span>
            )}
            {activeAccount.isHibernated && (
              <span
                style={{
                  fontSize: '0.75rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  color: '#ef4444',
                  padding: '1px 6px',
                  borderRadius: 4,
                  fontWeight: 600
                }}
              >
                Hibernated
              </span>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          className="btn-secondary"
          style={{
            padding: '5px 10px',
            fontSize: '0.8rem',
            gap: 8,
            color: 'var(--text-muted)'
          }}
          onClick={onOpenQuickSwitcher}
          title="Quick Switcher"
        >
          <Search size={14} />
          <span>Quick Switch</span>
          <kbd>⌘K</kbd>
        </button>

        {activeAccount && (
          <>
            <button
              className="btn-icon"
              title={activeAccount.isMuted ? 'Unmute notifications' : 'Mute notifications'}
              onClick={() => onToggleMute(activeAccount)}
            >
              {activeAccount.isMuted ? <BellOff size={16} color="#ef4444" /> : <Bell size={16} />}
            </button>
            <button
              className="btn-icon"
              title={
                activeAccount.isHibernated
                  ? 'Wake account (load web view)'
                  : 'Hibernate account (unload view to save RAM)'
              }
              onClick={() => onToggleHibernate(activeAccount)}
            >
              <Power
                size={16}
                color={activeAccount.isHibernated ? '#ef4444' : 'var(--text-muted)'}
              />
            </button>
          </>
        )}
      </div>
    </header>
  )
}
