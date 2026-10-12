# Unibox Phase 1: Stabilization, Security Hardening, and Reliability

## 1. Executive Summary
During Phase 1 engineering stabilization, Unibox was upgraded from an end-of-life runtime to a modern, supported Electron baseline (Electron 44.7.0), hardened against OS command injection and adversarial navigation attacks, fortified with IPC sender validation and input sanitization, equipped with true on-disk session data erasure, repaired for context-isolated Notification API proxying and resilient title unread detection, and backed by a comprehensive 11-phase automated integration test suite exercising real production classes.

---

## 2. Tracking Matrix & Final Status

| Task ID | Task Description | Status | Verification & Evidence |
|---|---|---|---|
| **Task A** | Electron Runtime Upgrade & Dependency Audit | **COMPLETE** | Upgraded from EOL Electron `33.4.11` to `44.7.0` (Chromium 144+). Resolved deprecated APIs (`appcache`/`websql` in storage options, `navigationHistory`). Full `typecheck` and `build` passing. |
| **Task B** | Navigation Security & URL Hardening | **COMPLETE** | Implemented `src/main/security.ts`. Strict HTTPS enforcement, strict subdomain boundaries, disallowance of `data:`, `javascript:`, and non-web schemes. Wrapped `shell.openExternal()` with `safeOpenExternal()` to prevent OS protocol injection. |
| **Task C** | IPC Sender Validation & Permission Controls | **COMPLETE** | Implemented `assertTrustedRenderer()` guarding all administrative IPC channels against remote web views. Sanitized badge counts and notification payloads. Configured origin-bound permissions with default-deny for main window session. |
| **Task D** | Account Removal & Session Data Erasure | **COMPLETE** | Implemented `SessionManager.eraseSession()`, invoking `ses.clearStorageData()`, `clearCache()`, `clearHostResolverCache()`, and `clearAuthCache()`. Verified cookie erasure in automated tests. Fixed hibernated account deletion. |
| **Task E** | Notification Architecture & Context Isolation | **COMPLETE** | Repaired preload Notification interception by bridging to Main World via `contextBridge` and `webFrame.executeJavaScript`. Upgraded title badge parsing to handle `(99+)`, bullets `•`, and square brackets `[x]` across all 6 services. |
| **Task F** | Test Strategy & Production Class Integration | **COMPLETE** | Replaced `MockStore` and dummy test functions in `test/verify.js` with direct testing of production classes (`AppStore`, `SessionManager`, `ViewManager`, `NotificationBridge`, `security.ts`). Added `test` npm script. |
| **Task G** | Core Functionality Preservation | **COMPLETE** | Multi-account isolation, zero-reload switching, quick switcher, theme preference, and view visibility controls preserved and tested. |
| **Task H** | Documentation & Verification Checklist | **COMPLETE** | `CLAUDE.md`, `README.md`, and `docs/PHASE_1_STABILIZATION.md` fully synchronized. |

---

## 3. Confirmed Defects & Root Causes

### Defect 1: End-of-Life Runtime & Chromium Vulnerabilities
- **Original Behavior**: Application ran on Electron `33.4.11` (Chromium 130), which reached End-of-Life in April 2025.
- **Root Cause**: Stale dependency configuration leaving modern Chromium security patches unapplied.
- **Fix**: Upgraded `devDependencies.electron` to `^44.7.0`. Updated deprecated Chromium storage options and navigation APIs (`navigationHistory`).
- **Verification**: `npx electron --version` reports `v44.7.0`. Smoke test and verification tests execute cleanly without runtime crashes.

### Defect 2: OS Command Injection via `shell.openExternal()`
- **Original Behavior**: Any URL rejected by `isUrlAllowed()` in `will-navigate` or `setWindowOpenHandler` was passed directly to `shell.openExternal(targetUrl)`.
- **Root Cause**: Lack of protocol filtering prior to delegating to OS handlers. Malicious chat links containing `file://`, `ms-msdt:`, `calculator:`, `javascript:`, or custom desktop protocol schemes would trigger native OS command execution.
- **Fix**: Created `safeOpenExternal(targetUrl)` in `src/main/security.ts`. Only `https:` and `http:` protocols are permitted; all other schemes are blocked and logged.
- **Verification**: Automated test asserting rejection of `file:///etc/passwd`, `javascript:alert(1)`, `ms-msdt://`, and `calculator://`.

### Defect 3: Permissive URL Validation (`data:` and Lookalikes)
- **Original Behavior**: `isUrlAllowed()` explicitly returned `true` for `parsed.protocol === 'data:'` and did not enforce `https:`.
- **Root Cause**: Overly permissive protocol checks and substring matching allowing arbitrary script execution via `data:text/html,...` or plain `http:` MITM.
- **Fix**: Enforced `parsed.protocol === 'https:'` (with exact `about:blank` exception for blank frames). Required exact hostname match or dot-separated subdomain match (`hostname === domain || hostname.endsWith('.' + domain)`). Removed `googleusercontent.com` from Gmail allowlist to prevent user-uploaded malicious script access.
- **Verification**: Comprehensive adversarial URL tests verifying rejection of plain HTTP, lookalike domains (`web.whatsapp.com.attacker.com`), `data:`, `javascript:`, and malformed URLs.

### Defect 4: Zero IPC Sender Validation
- **Original Behavior**: IPC handlers in `src/main/ipc.ts` never inspected `event.sender` or `event.senderFrame`.
- **Root Cause**: Assumption that only the trusted UI renderer would invoke IPC. Under context isolation and web view injection, a compromised service web view or auxiliary iframe could invoke administrative channels (`accounts:remove`, `settings:update`).
- **Fix**: Implemented `assertTrustedRenderer(event, mainWindow)` on all administrative channels, verifying sender WebContents ID, top-level main frame, and approved renderer URL. Added `sanitizeBadgeCount` and `sanitizeNotificationPayload` for service events.
- **Verification**: Automated unit test asserting rejection of foreign sender IDs.

### Defect 5: Permanent On-Disk Session Data Leakage on Account Removal
- **Original Behavior**: Deleting an account only deleted the session entry from an in-memory `Map`. Cookies, OAuth credentials, LocalStorage, and IndexedDB persisted on disk in `<userData>/Partitions/persist:<serviceId>-<accountId>/`.
- **Root Cause**: `ipc.ts` never invoked `sessionManager`, and `sessionManager.removeSession()` never called Chromium storage erasure APIs.
- **Fix**: Implemented `SessionManager.eraseSession()` which awaits `ses.clearStorageData()`, `clearCache()`, `clearHostResolverCache()`, and `clearAuthCache()`. Updated `accounts:remove` in `ipc.ts` to erase the session before removing account metadata from `AppStore`.
- **Verification**: In-process Electron test setting session cookies on `persist:whatsapp-...`, invoking `eraseSession()`, and asserting cookie array is empty.

### Defect 6: Broken Notification Interception Due to Context Isolation
- **Original Behavior**: `src/preload/service.ts` attempted `window.Notification = UniboxNotification`. Under `contextIsolation: true`, this only mutated the isolated preload realm; the web page's JavaScript realm continued using native browser notifications, bypassing Unibox muting, badge counters, and click routing.
- **Root Cause**: Context isolation isolates preload `window` from the page's main world `window`.
- **Fix**: In `service.ts`, exposed a constrained `__uniboxPrivateBridge` via `contextBridge.exposeInMainWorld()` and injected `UniboxProxyNotification` into the Main World using `webFrame.executeJavaScript()`. Denied direct session `'notifications'` permission to prevent duplicate unmanaged OS alerts.
- **Verification**: Verified compilation, context bridge injection, and `shouldDeliverNotification` routing rules.

### Defect 7: Incompatible and Broken Title Unread Parsing
- **Original Behavior**: `titleBadgeRegex: '^\\((\\d+)\\)'` failed for `(99+)` and Discord bullets (`• Discord | @me`).
- **Root Cause**: Regex required strict numbers and exact start without supporting trailing `+` or bullet indicators.
- **Fix**: Implemented `parseUnreadFromTitle()` supporting `(\d+)\+?`, brackets `[\(\[]`, bullets `^[•●]`, and service custom regexes. Updated `SERVICES_CONFIG` across all 6 services.
- **Verification**: Automated test verifying 12 real-world title patterns across WhatsApp, Instagram, Telegram, Discord, Threads, and Gmail.

### Defect 8: Mock-Only Verification Suite
- **Original Behavior**: `test/verify.js` tested zero production classes, relying on `MockStore` and re-implemented test-only functions.
- **Root Cause**: Test script did not import compiled production bundles or production main process classes.
- **Fix**: Added `src/main/testExports.ts` emitting `out/main/testExports.js`. Rewrote `test/verify.js` to run against real production classes: `AppStore`, `SessionManager`, `ViewManager`, `NotificationBridge`, and `security.ts`.
- **Verification**: Complete 11-step verification suite runs via `npm test` and exits with code 0.

---

## 4. Key Files Changed

1. `package.json`: Upgraded Electron to `44.7.0`, added `npm test` script.
2. `src/main/security.ts`: New security layer providing `isUrlAllowed`, `safeOpenExternal`, `assertTrustedRenderer`, `sanitizeBadgeCount`, `sanitizeNotificationPayload`, and `parseUnreadFromTitle`.
3. `src/main/sessionManager.ts`: Integrated storage erasure (`eraseSession`), strict permissions (default-deny notifications, main frame media only), `will-redirect`, `will-frame-navigate`, and child window security attachment.
4. `src/main/ipc.ts`: Enforced `assertTrustedRenderer`, payload sanitization, and session disk erasure on account removal.
5. `src/main/index.ts`: Added main window navigation protection, safe external URL handler, default-deny session permissions, and clean lifecycle management.
6. `src/main/viewManager.ts`: Fixed wakeAccount active state, used `navigationHistory` with fallbacks, guarded navigation event broadcasts.
7. `src/main/store.ts`: Added optional constructor dependency injection for testability without mocks.
8. `src/main/testExports.ts`: Created headless production exports for automated integration testing.
9. `src/preload/service.ts`: Implemented Main World Notification proxy via `contextBridge` + `webFrame.executeJavaScript`.
10. `src/shared/services.ts`: Updated `titleBadgeRegex` and tightened allowed domains.
11. `electron.vite.config.ts`: Configured rollup input for `testExports`.
12. `test/verify.js`: Comprehensive 11-phase verification suite testing real production classes.
13. `CLAUDE.md` & `README.md`: Updated architecture, security guidelines, and test commands.

---

## 5. Automated Verification Results

Command: `npm test` (`npm run build && node test/verify.js`)
- TypeScript Node & Web checks: **0 errors**
- Production bundle: **All bundles emitted cleanly** (`out/main`, `out/preload`, `out/renderer`)
- Verification Results:
  - 1️⃣ Production Services Registry: **PASSED** (6 services verified)
  - 2️⃣ Production Title Badge Parsing: **PASSED** (12 patterns verified across all 6 services)
  - 3️⃣ Adversarial URL Validation: **PASSED** (HTTPS enforced, lookalikes blocked, malicious schemes rejected)
  - 4️⃣ `safeOpenExternal` Protocol Hardening: **PASSED** (non-web schemes blocked)
  - 5️⃣ Input Sanitization: **PASSED** (bounds, lengths, types sanitized)
  - 6️⃣ Production `AppStore` Multi-Account Persistence: **PASSED** (3 accounts created, survived restart, order & active preserved)
  - 7️⃣ `NotificationBridge` Muting Rules: **PASSED** (account-level and global muting verified)
  - 8️⃣ Session Partitions & Storage Data Erasure: **PASSED** (partitions isolated, cookies purged on disk)
  - 9️⃣ `ViewManager` Lifecycle & Occlusion Fix: **PASSED** (switching, bounds hiding/restoring, hibernation/waking verified)
  - 🔟 IPC Sender Validation Guard: **PASSED** (unauthorized foreign senders rejected)
  - 1️⃣1️⃣ Build Distribution Files: **PASSED** (all distribution artifacts validated)

---

## 6. Manual Verification Checklist (User Instructions)

To manually test the application in a desktop graphical environment:

1. **Launch the application**:
   ```bash
   npm run dev
   ```
2. **Add Two WhatsApp Accounts**:
   - In the sidebar, click the `+` button next to WhatsApp.
   - Enter label `"Personal WhatsApp"`, select green color, click `Create Account`.
   - The WhatsApp QR code login page loads in the main view.
   - Click `+` next to WhatsApp again.
   - Enter label `"Work WhatsApp"`, select a different color (e.g. blue), click `Create Account`.
   - A second, completely independent WhatsApp QR code login page loads.
3. **Verify Isolated Logins**:
   - Log into Account 1 using Phone A.
   - Switch to Account 2 using the sidebar or <kbd>Ctrl+2</kbd>.
   - Log into Account 2 using Phone B.
   - Switch back to Account 1: confirm you are still logged into Account 1 without reloading.
4. **Test Quick Switcher & Shortcuts**:
   - Press <kbd>Ctrl+K</kbd> to open the Quick Switcher.
   - Type `"Work"` and press <kbd>Enter</kbd>: Account 2 is focused immediately.
   - Press <kbd>Ctrl+1</kbd>: instantly switches back to Account 1.
5. **Test App Restart Persistence**:
   - Close Unibox completely (<kbd>Ctrl+Q</kbd> or close window).
   - Relaunch with `npm run dev`.
   - Both WhatsApp accounts reappear in the sidebar. Both remain logged in with separate sessions.
6. **Test Account Removal & Session Erasure**:
   - Click the gear icon on Account 2 and click `Remove Account`.
   - Confirm deletion. Account 2 disappears from the sidebar.
   - Add a new WhatsApp account: verify it shows the fresh QR code login rather than automatically logging into Account 2.
7. **Test Notification Muting**:
   - Open settings for an account, toggle `Mute notifications`. Send a test message to that account. Confirm no OS sound or alert is triggered, while badge count reflects unreads.
