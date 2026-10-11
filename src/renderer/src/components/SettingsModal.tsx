import React from 'react'
import { X, ShieldCheck, HardDrive, BellOff } from 'lucide-react'
import { AppSettings } from '@shared/types'

interface SettingsModalProps {
  isOpen: boolean
  settings: AppSettings
  onClose: () => void
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  onClose,
  onUpdateSettings
}) => {
  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Settings & Preferences</h3>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Theme */}
          <div className="form-group">
            <label className="form-label">Theme</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {(['dark', 'light'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={settings.theme === mode ? 'btn-primary' : 'btn-secondary'}
                  style={{ flex: 1, textTransform: 'capitalize' }}
                  onClick={() => onUpdateSettings({ theme: mode })}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Global Mute */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>Global Mute</div>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                Silence all notification popups and sounds
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.globalMute}
              onChange={(e) => onUpdateSettings({ globalMute: e.target.checked })}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
          </div>

          {/* Sidebar default */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>Compact Sidebar</div>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                Collapse sidebar to icons only
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.sidebarCollapsed}
              onChange={(e) => onUpdateSettings({ sidebarCollapsed: e.target.checked })}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
          </div>

          {/* Privacy & Isolation Card */}
          <div
            style={{
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              marginTop: 6
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#10b981', fontWeight: 600, fontSize: '0.85rem' }}>
              <ShieldCheck size={16} />
              <span>Isolated Local Storage Active</span>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.4 }}>
              Every account runs in its own private persistent partition (<code>persist:&lt;service&gt;-&lt;account&gt;</code>). Cookies and sessions are never shared and stay strictly on your device.
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
