import React, { useState, useEffect, useRef } from 'react'
import { Search, Hash } from 'lucide-react'
import { Account } from '@shared/types'
import { SERVICES_CONFIG } from '@shared/services'

interface QuickSwitcherProps {
  isOpen: boolean
  accounts: Account[]
  onClose: () => void
  onSelectAccount: (accountId: string) => void
}

export const QuickSwitcher: React.FC<QuickSwitcherProps> = ({
  isOpen,
  accounts,
  onClose,
  onSelectAccount
}) => {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  if (!isOpen) return null

  // Order accounts
  const sortedAccounts = [...accounts].sort((a, b) => a.order - b.order)

  // Filter items matching query
  const filtered = sortedAccounts.filter((account) => {
    const service = SERVICES_CONFIG[account.serviceId]
    const q = query.toLowerCase().trim()
    if (!q) return true
    return (
      account.label.toLowerCase().includes(q) ||
      service?.name.toLowerCase().includes(q) ||
      account.serviceId.toLowerCase().includes(q)
    )
  })

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1 < filtered.length ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filtered.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[selectedIndex]) {
        onSelectAccount(filtered[selectedIndex].id)
        onClose()
      }
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content quick-switcher-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="quick-switcher-input-wrapper">
          <Search size={18} color="var(--text-dim)" />
          <input
            ref={inputRef}
            type="text"
            className="quick-switcher-input"
            placeholder="Type a service or account name to switch..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
          />
          <kbd>ESC</kbd>
        </div>

        <div className="quick-switcher-results">
          {filtered.length === 0 ? (
            <div
              style={{
                padding: '24px',
                textAlign: 'center',
                color: 'var(--text-dim)',
                fontSize: '0.9rem'
              }}
            >
              No matching accounts found for "{query}"
            </div>
          ) : (
            filtered.map((account, idx) => {
              const service = SERVICES_CONFIG[account.serviceId]
              const isSelected = idx === selectedIndex
              const shortcutIndex = sortedAccounts.findIndex((a) => a.id === account.id)
              const shortcutNumber = shortcutIndex >= 0 && shortcutIndex < 9 ? shortcutIndex + 1 : null

              return (
                <div
                  key={account.id}
                  className={`quick-switcher-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    onSelectAccount(account.id)
                    onClose()
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        backgroundColor: account.color
                      }}
                    />
                    <span style={{ fontWeight: 600 }}>{service?.name}</span>
                    <span style={{ color: 'var(--text-dim)' }}>—</span>
                    <span>{account.label}</span>
                    {account.unreadCount > 0 && (
                      <span className="badge-count" style={{ fontSize: '0.7rem' }}>
                        {account.unreadCount}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {shortcutNumber && <kbd>⌘{shortcutNumber}</kbd>}
                    {isSelected && <kbd>↵ Enter</kbd>}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
