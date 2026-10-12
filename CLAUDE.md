# Unibox Architecture & Developer Guidelines

## Overview
Unibox is an All-in-One Messenger desktop app built with **Electron + TypeScript + React**. It enables users to run multiple messaging services (WhatsApp, Instagram DMs, Telegram, Discord, Threads, Gmail) with multiple isolated accounts per service in a single unified window.

---

## Core Architecture Principles

1. **Official Web Apps Only**:
   - Strictly NO private APIs, scrapers, or reverse-engineered libraries.
   - Each service is loaded directly via its official web app URL.

2. **Isolated WebContentsViews (Electron 44+)**:
   - Modern `WebContentsView` is used instead of deprecated `<webview>` or `BrowserView`.
   - Inactive views are maintained alive in the background (hidden / not attached to active hierarchy) without reloading pages, preserving chat states, active conversations, and RAM caches.
   - Hibernate account unloads the view to conserve memory when explicitly requested, while keeping the persistent session partition intact.

3. **Strict Session Isolation & Secure Lifecycle**:
   - Each account has its own isolated persistent partition:
     `session.fromPartition('persist:<serviceId>-<accountId>')`
   - Cookies, local storage, indexedDB, and cache are completely partitioned per account.
   - On account removal, `SessionManager.eraseSession()` explicitly purges all persistent data from disk (`clearStorageData`, `clearCache`, `clearAuthCache`, `clearHostResolverCache`).
   - Credentials remain solely on the local machine; zero backend in MVP.

4. **Security Hardening**:
   - Context isolation enabled (`contextIsolation: true`).
   - Node integration disabled (`nodeIntegration: false`).
   - Sandbox enabled (`sandbox: true`).
   - Restrictive HTTPS-only navigation policy via `isUrlAllowed()`. Rejects `data:`, `javascript:`, `file:`, plain `http:`, and non-web protocol schemes.
   - Protected external link dispatcher via `safeOpenExternal()`: enforces `https:` and `http:` before invoking the OS shell, preventing OS command injection from chat messages.
   - Protected IPC layer via `assertTrustedRenderer()`: ensures administrative IPC requests originate exclusively from the trusted main window renderer, not remote web views or auxiliary frames.
   - Origin-bound permission handlers: media (`camera`, `microphone`), `fullscreen`, and `pointerLock` allowed only for verified main-frame service origins; location and unverified requests denied.

5. **User-Agent Handling**:
   - Strips `Electron/...` and custom app tokens from default user agents to prevent services like WhatsApp Web or Discord from serving unsupported-browser warnings.

6. **Unified Notifications & Badges**:
   - Intercepts `window.Notification` in the service Main World using `webFrame.executeJavaScript` + `contextBridge` to bridge notifications to the native host under `contextIsolation: true`.
   - Observes `document.title` mutations and native `page-title-updated` events using `parseUnreadFromTitle` to extract unread counts across all services (supporting `(99+)`, bullets `•`, and square brackets `[x]`).
   - Clicking native notifications focuses the specific account view.

---

## Folder Structure

```
unibox/
├── electron.vite.config.ts  # Build configuration for main, preload, renderer
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.web.json
├── docs/
│   └── PHASE_1_STABILIZATION.md # Complete Phase 1 security & reliability documentation
├── src/
│   ├── main/                # Electron Main process
│   │   ├── index.ts         # App lifecycle, main window, shortcuts, security initialization
│   │   ├── sessionManager.ts# Session partition, UA, security policies, permissions, storage erasure
│   │   ├── viewManager.ts   # WebContentsView lifecycle, switching, hibernation, sizing, occlusion
│   │   ├── notificationBridge.ts # Badge count calculation, native notifications, muting
│   │   ├── security.ts      # URL validation, safeOpenExternal, IPC assertions, input sanitization
│   │   ├── store.ts         # Atomic JSON persistence for accounts and settings (with DI for testing)
│   │   ├── ipc.ts           # IPC handlers & event dispatchers with sender validation
│   │   └── testExports.ts   # Production exports for integration testing
│   ├── preload/             # Preload scripts
│   │   ├── index.ts         # Renderer IPC bridge (window.unibox)
│   │   └── service.ts       # Service view preload (title observer & Notification proxy via contextBridge)
│   ├── renderer/            # React UI
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       ├── index.css
│   │       └── components/
│   │           ├── Sidebar.tsx
│   │           ├── Header.tsx
│   │           ├── AccountModal.tsx
│   │           ├── SettingsModal.tsx
│   │           ├── QuickSwitcher.tsx
│   │           └── EmptyState.tsx
│   └── shared/              # Shared types and constants
│       ├── types.ts
│       └── services.ts      # Service registry & configuration
```

---

## Service Registry (`src/shared/services.ts`)

| Service | URL | Allowed Domains | Unread Detection Pattern |
| :--- | :--- | :--- | :--- |
| **WhatsApp** | `https://web.whatsapp.com` | `web.whatsapp.com`, `whatsapp.com`, `whatsapp.net`, `facebook.com` | `^[\(\[]\s*(\d+)\+?\s*[\)\]]` |
| **Instagram** | `https://www.instagram.com/direct/inbox/` | `instagram.com`, `www.instagram.com`, `facebook.com`, `fbcdn.net` | `^[\(\[]\s*(\d+)\+?\s*[\)\]]` |
| **Telegram** | `https://web.telegram.org/k/` | `web.telegram.org`, `telegram.org`, `telegram.me`, `t.me` | `^[\(\[]\s*(\d+)\+?\s*[\)\]]` |
| **Discord** | `https://discord.com/app` | `discord.com`, `discordapp.com`, `discord.gg`, `discord.media` | `^[\(\[]\s*(\d+)\+?\s*[\)\]]` or `^[•●]` |
| **Threads** | `https://www.threads.net` | `threads.net`, `www.threads.net`, `instagram.com` | `^[\(\[]\s*(\d+)\+?\s*[\)\]]` |
| **Gmail** | `https://mail.google.com` | `mail.google.com`, `accounts.google.com`, `google.com`, `gstatic.com` | `[\(\[]\s*(\d+)\+?\s*[\)\]]` |

---

## Development & Testing Workflow

- **Dev mode**: `npm run dev` (starts Vite dev server and launches Electron)
- **Typecheck**: `npm run typecheck`
- **Build**: `npm run build`
- **Verification Suite**: `npm test` or `node test/verify.js` (runs complete 11-phase integration & security suite against real production classes)
- **Package**: `npm run build:unpack` or `npm run build:linux`
