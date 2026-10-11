import React from 'react'
import { Plus, Shield, Zap, Lock } from 'lucide-react'
import { ServiceId } from '@shared/types'
import { SERVICES_LIST } from '@shared/services'

interface EmptyStateProps {
  onAddAccount: (serviceId?: ServiceId) => void
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onAddAccount }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '32px',
        textAlign: 'center',
        backgroundColor: 'var(--bg-app)'
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          backgroundColor: '#3b82f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontWeight: 800,
          fontSize: '2rem',
          marginBottom: 20,
          boxShadow: '0 8px 16px rgba(59, 130, 246, 0.3)'
        }}
      >
        U
      </div>

      <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: 8 }}>
        Welcome to Unibox
      </h2>
      <p
        style={{
          color: 'var(--text-muted)',
          maxWidth: 480,
          fontSize: '0.95rem',
          lineHeight: 1.5,
          marginBottom: 32
        }}
      >
        Your unified desktop messenger. Keep WhatsApp, Instagram, Telegram, Discord, Threads, and Gmail in one fast, private window with isolated multi-account sessions.
      </p>

      {/* Service grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          maxWidth: 580,
          width: '100%',
          marginBottom: 36
        }}
      >
        {SERVICES_LIST.map((service) => (
          <div
            key={service.id}
            onClick={() => onAddAccount(service.id)}
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 10,
              padding: '16px 12px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = service.themeColor
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color)'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: service.themeColor
              }}
            />
            <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>{service.name}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Add account
            </span>
          </div>
        ))}
      </div>

      {/* Feature highlights */}
      <div
        style={{
          display: 'flex',
          gap: 24,
          color: 'var(--text-dim)',
          fontSize: '0.82rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Lock size={15} color="#10b981" />
          <span>Local isolated partitions</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Zap size={15} color="#f59e0b" />
          <span>No reload switching</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Shield size={15} color="#3b82f6" />
          <span>Zero cloud backend</span>
        </div>
      </div>
    </div>
  )
}
