# Unibox 📦
> **All-in-One Messenger Desktop App (MVP)**

Unibox lets you run **WhatsApp**, **Instagram DMs**, **Telegram**, **Discord**, **Threads**, and **Gmail** in **ONE unified window**, with multiple accounts per service and instant, zero-reload switching between them.

---

## ⚡ Key Highlights

- **Electron + TypeScript + React**: Fast, responsive desktop client powered by Vite and Electron 33+.
- **Zero Scraping / Official Web Apps Only**: Loads official web clients inside modern `WebContentsView` instances (never deprecated `<webview>`).
- **Completely Isolated Persistent Sessions**: Every account receives its own isolated persistent partition (`session.fromPartition('persist:<serviceId>-<accountId>')`). Logins, cookies, and tokens never collide.
- **Local-Only Storage**: All sessions, settings, and account metadata remain 100% on your device. Zero cloud backend.
- **Instant Account Switching**: Keep background views alive in memory with no reload on switch. Conversations stay right where you left them.
- **Unified Notifications & Badges**: Automatic unread detection using `document.title` mutations and native Notification API proxying. Synchronizes total unread badge count to OS dock / taskbar.
- **Per-Account Customization**: Color tags, custom account labels, notification muting, RAM hibernation, and custom User-Agent overrides.
- **Quick Switcher (`Cmd/Ctrl+K`)**: Fuzzy search across all accounts and services with full keyboard navigation.
- **Direct Shortcuts (`Cmd/Ctrl+1..9`)**: Instantly jump between accounts using global hotkeys.

---

## 🛠️ Supported Services

| Service | URL | Allowed Domains | Unread Badge Detection |
| :--- | :--- | :--- | :--- |
| **WhatsApp** | `https://web.whatsapp.com` | `web.whatsapp.com`, `whatsapp.com`, `whatsapp.net`, `facebook.com` | Title regex `^\((\d+)\)` |
| **Instagram** | `https://www.instagram.com/direct/inbox/` | `instagram.com`, `www.instagram.com`, `facebook.com` | Title regex `^\((\d+)\)` |
| **Telegram** | `https://web.telegram.org/k/` | `web.telegram.org`, `telegram.org`, `t.me` | Title regex `^\((\d+)\)` |
| **Discord** | `https://discord.com/app` | `discord.com`, `discordapp.com`, `discord.gg` | Title regex `^\((\d+)\)` / `•` |
| **Threads** | `https://www.threads.net` | `threads.net`, `www.threads.net`, `instagram.com` | Title regex `^\((\d+)\)` |
| **Gmail** | `https://mail.google.com` | `mail.google.com`, `accounts.google.com`, `google.com` | Title regex `\((\d+)\)` |

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Ctrl</kbd> / <kbd>Cmd</kbd> + <kbd>K</kbd> | Open Quick Switcher modal (fuzzy search) |
| <kbd>Ctrl</kbd> / <kbd>Cmd</kbd> + <kbd>1</kbd> .. <kbd>9</kbd> | Switch directly to Account 1 .. 9 |
| <kbd>Esc</kbd> | Close Quick Switcher or open modal |
| <kbd>↑</kbd> / <kbd>↓</kbd> + <kbd>Enter</kbd> | Navigate and select account in Quick Switcher |

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18
- npm or yarn

### Installation
```bash
# Clone or navigate to the repository
cd unibox

# Install dependencies
npm install
```

### Running in Development
```bash
npm run dev
```
Starts the Vite dev server with Hot Module Replacement (HMR) and launches the Electron desktop shell.

### Typechecking & Testing
```bash
# Run TypeScript checks for Node and Web
npm run typecheck

# Run automated integration and architecture test suite
node test/verify.js
```

### Production Build & Packaging
```bash
# Build production bundle
npm run build

# Package unpacked directory for current OS
npm run build:unpack

# Package installers
npm run build:linux   # AppImage & tar.gz on Linux
npm run build:win     # NSIS installer & zip on Windows
npm run build:mac     # DMG & zip on macOS
```

---

## 🏛️ Architecture & Security

```
src/
├── main/
│   ├── index.ts              # Window lifecycle, global shortcuts, app events
│   ├── sessionManager.ts     # Session partitions, custom UA, domain whitelist, permissions
│   ├── viewManager.ts        # WebContentsView lifecycle, bounds layout, hibernation
│   ├── notificationBridge.ts # Badge count calculation, native notifications
│   ├── store.ts              # Atomic JSON persistence (app.getPath('userData')/unibox_data.json)
│   └── ipc.ts                # Strongly typed IPC handlers & event dispatchers
├── preload/
│   ├── index.ts              # Renderer IPC bridge (contextBridge.exposeInMainWorld)
│   └── service.ts            # Service webview preload (title observer & notification proxy)
├── renderer/
│   ├── index.html            # Main HTML document
│   └── src/
│       ├── main.tsx          # React 19 entry point
│       ├── App.tsx           # Layout, bounds sync, modal management
│       ├── index.css         # Dark & light theme variables and animations
│       └── components/
│           ├── Sidebar.tsx   # Collapsible services, accounts list, unread badges
│           ├── Header.tsx    # Navigation controls, active account badge, quick actions
│           ├── AccountModal.tsx   # Add/Edit account dialog (label, color, UA override)
│           ├── SettingsModal.tsx  # Theme, global mute, sidebar configuration
│           ├── QuickSwitcher.tsx  # Fuzzy search palette with keyboard navigation
│           └── EmptyState.tsx     # First-run welcome and service launcher
└── shared/
    ├── types.ts              # TypeScript interfaces
    └── services.ts           # Config-driven service registry
```

### Security Guardrails
1. **Sandboxing**: `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`.
2. **Domain Whitelisting**: Navigations outside each service's official domain list are canceled and opened in the default external system browser (`shell.openExternal`).
3. **Strict Permissions**: Notifications and media (camera/microphone for calls) are granted exclusively to whitelisted service domains. Geolocation, sensors, and background sync are blocked.
4. **Clean User-Agent**: Eliminates `Electron/...` tokens to ensure seamless compatibility with WhatsApp Web and Discord.

---

## 🗺️ Roadmap (Post-MVP)

- **Phase 2 (Native Integrations)**: Real unified inbox for services with official APIs (Telegram TDLib, Gmail OAuth & Gmail API) alongside WebViews for other services.
- **Phase 3 (Mobile)**: React Native companion app with push notifications.
- **Phase 4 (Startup Layer)**: Encrypted cloud sync, team onboarding, crash telemetry, and automatic updates.
