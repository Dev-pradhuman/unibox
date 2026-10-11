import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Account, AccountCreateInput, AccountUpdateInput, ServiceId } from '@shared/types'
import { SERVICES_CONFIG, SERVICES_LIST } from '@shared/services'

interface AccountModalProps {
  isOpen: boolean
  accountToEdit?: Account | null
  initialServiceId?: ServiceId
  onClose: () => void
  onSave: (data: AccountCreateInput | AccountUpdateInput) => void
}

const PRESET_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16'  // Lime
]

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  accountToEdit,
  initialServiceId,
  onClose,
  onSave
}) => {
  const [serviceId, setServiceId] = useState<ServiceId>(initialServiceId || 'whatsapp')
  const [label, setLabel] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [isMuted, setIsMuted] = useState(false)
  const [customUserAgent, setCustomUserAgent] = useState('')

  useEffect(() => {
    if (accountToEdit) {
      setServiceId(accountToEdit.serviceId)
      setLabel(accountToEdit.label)
      setColor(accountToEdit.color)
      setIsMuted(accountToEdit.isMuted)
      setCustomUserAgent(accountToEdit.customUserAgent || '')
    } else {
      const svc = initialServiceId || 'whatsapp'
      setServiceId(svc)
      setLabel(`${SERVICES_CONFIG[svc].name} Account`)
      setColor(SERVICES_CONFIG[svc].themeColor || PRESET_COLORS[0])
      setIsMuted(false)
      setCustomUserAgent('')
    }
  }, [accountToEdit, initialServiceId, isOpen])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!label.trim()) return

    if (accountToEdit) {
      onSave({
        id: accountToEdit.id,
        label: label.trim(),
        color,
        isMuted,
        customUserAgent: customUserAgent.trim() || undefined
      })
    } else {
      onSave({
        serviceId,
        label: label.trim(),
        color,
        customUserAgent: customUserAgent.trim() || undefined
      })
    }
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">
            {accountToEdit ? 'Edit Account' : 'Add New Account'}
          </h3>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {/* Service selection (only when creating) */}
          {!accountToEdit && (
            <div className="form-group">
              <label className="form-label">Service</label>
              <select
                className="form-select"
                value={serviceId}
                onChange={(e) => {
                  const sId = e.target.value as ServiceId
                  setServiceId(sId)
                  setLabel(`${SERVICES_CONFIG[sId].name} Account`)
                  setColor(SERVICES_CONFIG[sId].themeColor || PRESET_COLORS[0])
                }}
              >
                {SERVICES_LIST.map((svc) => (
                  <option key={svc.id} value={svc.id}>
                    {svc.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Account Label */}
          <div className="form-group">
            <label className="form-label">Account Label</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Personal, Work, Project"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              autoFocus
            />
          </div>

          {/* Account Color */}
          <div className="form-group">
            <label className="form-label">Account Color Tag</label>
            <div className="color-presets">
              {PRESET_COLORS.map((c) => (
                <div
                  key={c}
                  className={`color-swatch ${color === c ? 'selected' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          {/* User Agent Override */}
          <div className="form-group">
            <label className="form-label">Custom User-Agent (Optional Override)</label>
            <input
              type="text"
              className="form-input"
              placeholder="Leave empty for default desktop Chrome UA"
              value={customUserAgent}
              onChange={(e) => setCustomUserAgent(e.target.value)}
              style={{ fontSize: '0.8rem' }}
            />
          </div>

          {/* Mute Notifications */}
          {accountToEdit && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
              <input
                type="checkbox"
                id="muteCheck"
                checked={isMuted}
                onChange={(e) => setIsMuted(e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              <label
                htmlFor="muteCheck"
                style={{ fontSize: '0.88rem', cursor: 'pointer', color: 'var(--text-main)' }}
              >
                Mute notifications for this account
              </label>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {accountToEdit ? 'Save Changes' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
