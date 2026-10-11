# Unibox Architecture & Developer Guidelines

## Overview
Unibox is an All-in-One Messenger desktop app built with **Electron + TypeScript + React**. It enables users to run multiple messaging services (WhatsApp, Instagram DMs, Telegram, Discord, Threads, Gmail) with multiple isolated accounts per service in a single unified window.

---

## Core Architecture Principles

1. **Official Web Apps Only**:
   - Strictly NO private APIs, scrapers, or reverse-engineered libraries.
   - Each service is loaded directly via its official web app URL.

2. **Isolated WebContentsViews (Electron 30+)**:
   - Modern `WebContentsView` is used instead of deprecated `<webview>` or `BrowserView`.
   - Inactive views are maintained alive in the background (hidden / not attached to active hierarchy) without reloading pages, preserving chat states, active conversations, and RAM caches.
   - Hibernate account unloads the view to conserve memory when explicitly requested, while keeping the persistent session partition intact.

3. **Strict Session Isolation**:
   - Each account has its own isolated persistent partition:
     `session.fromPartition('persist:<serviceId>-<accountId>')`
   - Cookies, local storage, indexedDB, and cache are completely partitioned per account.
   - Credentials remain solely on the local machine; zero backend in MVP.

4. **Security Hardening**:
   - Context isolation enabled (`contextIsolation: true`).
   - Node integration disabled (`nodeIntegration: false`).
   - Sandbox enabled (`sandbox: true`).
   - Navigation restricted: any navigation outside the service's whitelisted domains is canceled and dispatched to the native OS browser (`shell.openExternal`).
   - Strict permission handlers: camera, microphone, and notifications allowed only for whitelisted origins; geolocation/sensors denied.

5. **User-Agent Handling**:
   - Strips `Electron/...` and custom app tokens from default user agents to prevent services like WhatsApp Web or Discord from serving unsupported-browser warnings.

6. **Unified Notifications & Badges**:
   - Intercepts `window.Notification` in the service preload script and forwards to native OS notifications.
   - Observes `document.title` mutations using Regex (`\(\d+\)`) to extract unread counts and updates app badge / dock icon.
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
├── src/
│   ├── main/                # Electron Main process
│   │   ├── index.ts         # App lifecycle, main window, shortcuts
│   │   ├── sessionManager.ts# Session partition, UA, security policies, permissions
│   │   ├── viewManager.ts   # WebContentsView lifecycle, switching, hibernation, sizing
│   │   ├── notificationBridge.ts # Badge count calculation, native notifications
│   │   ├── store.ts         # Atomic JSON persistence for accounts and settings
│   │   └── ipc.ts           # IPC handlers & event dispatchers
│   ├── preload/             # Preload scripts
│   │   ├── index.ts         # Renderer IPC bridge (window.unibox)
│   │   └── service.ts       # Service view preload (title observer & notification proxy)
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
│       └── services.ts
```

---

## Service Registry (`src/shared/services.ts`)

| Service | URL | Allowed Domains | Unread Detection |
| :--- | :--- | :--- | :--- |
| **WhatsApp** | `https://web.whatsapp.com` | `web.whatsapp.com`, `whatsapp.com`, `whatsapp.net` | Title regex `^\((\d+)\)` |
| **Instagram** | `https://www.instagram.com/direct/inbox/` | `instagram.com`, `www.instagram.com` | Title regex `^\((\d+)\)` |
| **Telegram** | `https://web.telegram.org/k/` | `web.telegram.org`, `telegram.org` | Title regex `^\((\d+)\)` |
| **Discord** | `https://discord.com/app` | `discord.com`, `discordapp.com` | Title regex `^\((\d+)\)` |
| **Threads** | `https://www.threads.net` | `threads.net`, `www.threads.net` | Title regex `^\((\d+)\)` |
| **Gmail** | `https://mail.google.com` | `mail.google.com`, `accounts.google.com` | Title regex `\((\d+)\)` |

---

## Development & Testing Workflow

- **Dev mode**: `npm run dev` (starts Vite dev server and launches Electron)
- **Typecheck**: `npm run typecheck`
- **Build**: `npm run build`
- **Package**: `npm run build:unpack` or `npm run build:linux`
