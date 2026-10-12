# Unibox 📦
> **All-in-One Messenger Desktop App (MVP)**

Unibox lets you run **WhatsApp**, **Instagram DMs**, **Telegram**, **Discord**, **Threads**, and **Gmail** in **ONE unified window**, with multiple accounts per service and instant, zero-reload switching between them.

---

## ⚡ Key Highlights

- **Electron + TypeScript + React**: Fast, responsive desktop client powered by Vite and Electron 44+ (Chromium security-patched runtime).
- **Zero Scraping / Official Web Apps Only**: Loads official web clients inside modern `WebContentsView` instances (never deprecated `<webview>`).
- **Completely Isolated Persistent Sessions**: Every account receives its own isolated persistent partition (`session.fromPartition('persist:<serviceId>-<accountId>')`). Logins, cookies, and tokens never collide.
- **Local-Only Storage**: All sessions, settings, and account metadata remain 100% on your device. Zero cloud backend.
- **Complete Session Data Erasure**: When an account is removed, on-disk cookies, cache, localStorage, and IndexedDB data are thoroughly purged via `SessionManager.eraseSession()`.
- **Instant Account Switching**: Keep background views alive in memory with no reload on switch. Conversations stay right where you left them.
- **Unified Notifications & Badges**: Automatic unread detection using `document.title` mutations and native Notification API proxying via Main World `contextBridge` injection. Synchronizes total unread badge count to OS dock / taskbar.
- **Per-Account Customization**: Color tags, custom account labels, notification muting, RAM hibernation, and custom User-Agent overrides.
- **Security Hardened**:
  - Restrictive HTTPS-only navigation policies (`isUrlAllowed`).
  - Protected OS external link invocation (`safeOpenExternal`) rejecting non-web schemes (`file:`, `javascript:`, `ms-msdt:`, `calculator:`).
  - Main-frame IPC sender validation (`assertTrustedRenderer`) preventing malicious remote web views from issuing administrative commands.
  - Strict origin-bound permission controls.
- **Quick Switcher (`Cmd/Ctrl+K`)**: Fuzzy search across all accounts and services with full keyboard navigation.
- **Direct Shortcuts (`Cmd/Ctrl+1..9`)**: Instantly jump between accounts using global hotkeys.

---

## 🛠️ Supported Services

| Service | URL | Allowed Domains | Unread Badge Detection |
| :--- | :--- | :--- | :--- |
| **WhatsApp** | `https://web.whatsapp.com` | `web.whatsapp.com`, `whatsapp.com`, `whatsapp.net`, `facebook.com` | `^[\(\[]\s*(\d+)\+?\s*[\)\]]` |
| **Instagram** | `https://www.instagram.com/direct/inbox/` | `instagram.com`, `www.instagram.com`, `facebook.com`, `fbcdn.net` | `^[\(\[]\s*(\d+)\+?\s*[\)\]]` |
| **Telegram** | `https://web.telegram.org/k/` | `web.telegram.org`, `telegram.org`, `telegram.me`, `t.me` | `^[\(\[]\s*(\d+)\+?\s*[\)\]]` |
| **Discord** | `https://discord.com/app` | `discord.com`, `discordapp.com`, `discord.gg`, `discord.media` | `^[\(\[]\s*(\d+)\+?\s*[\)\]]` or `^[•●]` |
| **Threads** | `https://www.threads.net` | `threads.net`, `www.threads.net`, `instagram.com` | `^[\(\[]\s*(\d+)\+?\s*[\)\]]` |
| **Gmail** | `https://mail.google.com` | `mail.google.com`, `accounts.google.com`, `google.com`, `gstatic.com` | `[\(\[]\s*(\d+)\+?\s*[\)\]]` |

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

# Run automated integration, security, and multi-account verification test suite
npm test
# (or node test/verify.js)
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
│   ├── sessionManager.ts     # Session partitions, custom UA, domain allowlist, storage erasure
│   ├── viewManager.ts        # WebContentsView lifecycle, bounds layout, hibernation, occlusion
│   ├── notificationBridge.ts # Badge count calculation, native notifications, muting
│   ├── security.ts           # URL validation, safeOpenExternal, IPC assertions, input sanitization
│   ├── store.ts              # Atomic JSON persistence for accounts and settings (with DI support)
│   ├── ipc.ts                # IPC handlers with sender validation and payload sanitization
│   └── testExports.ts        # Headless exports for test verification suite
├── preload/
│   ├── index.ts              # Context-isolated bridge for React UI (window.unibox)
│   └── service.ts            # Service view preload (title observer & Main World Notification proxy)
├── renderer/                 # React UI shell
└── shared/
    ├── types.ts              # Shared TypeScript definitions
    └── services.ts           # Service configurations and regex definitions
```
