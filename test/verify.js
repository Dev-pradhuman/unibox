const assert = require('assert')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { spawnSync } = require('child_process')

console.log('🚀 Running Unibox Master Verification Suite (Phase 1)...\n')

// Ensure project is built so production bundle testExports is available
const testExportsPath = path.join(__dirname, '../out/main/testExports.js')
if (!fs.existsSync(testExportsPath)) {
  console.log('📦 out/main/testExports.js not found. Running electron-vite build first...')
  const buildResult = spawnSync('npm', ['run', 'build'], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf-8'
  })
  if (buildResult.status !== 0) {
    console.error(buildResult.stderr || buildResult.stdout)
    throw new Error('Build failed before running tests')
  }
}

// 1. Verify Production Services Registry
console.log('1️⃣  Verifying Production Services Registry...')
const servicesSource = fs.readFileSync(path.join(__dirname, '../src/shared/services.ts'), 'utf-8')
const expectedServices = ['whatsapp', 'instagram', 'telegram', 'discord', 'threads', 'gmail']

for (const svc of expectedServices) {
  assert.ok(servicesSource.includes(`id: '${svc}'`), `Service ${svc} must be defined in services.ts`)
  console.log(`   ✅ Service "${svc}" registered`)
}

// 2. Load Production Security & Parser Functions
console.log('\n2️⃣  Verifying Production Title Badge Parsing Across All 6 Services...')
const electronPath = path.join(__dirname, '../node_modules/electron/dist/electron')

// We will execute a dedicated in-depth test runner inside the Electron environment
// to test both headless pure functions and Electron-dependent classes.
const electronRunnerScript = `
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const { app, BrowserWindow, session } = require('electron');

app.whenReady().then(async () => {
  try {
    const prod = require(path.join(process.cwd(), 'out/main/testExports.js'));
    const {
      AppStore,
      SessionManager,
      ViewManager,
      NotificationBridge,
      SERVICES_CONFIG,
      isUrlAllowed,
      safeOpenExternal,
      assertTrustedRenderer,
      sanitizeBadgeCount,
      sanitizeNotificationPayload,
      parseUnreadFromTitle
    } = prod;

    // --- TEST 2.1: Title Parsing ---
    console.log('   Testing parseUnreadFromTitle on real-world title patterns:');
    assert.strictEqual(parseUnreadFromTitle('(3) WhatsApp'), 3, 'WhatsApp (3) failed');
    assert.strictEqual(parseUnreadFromTitle('(99+) WhatsApp'), 99, 'WhatsApp (99+) failed');
    assert.strictEqual(parseUnreadFromTitle('[12] Discord'), 12, 'Discord [12] failed');
    assert.strictEqual(parseUnreadFromTitle('• Discord | @me'), 1, 'Discord unread bullet failed');
    assert.strictEqual(parseUnreadFromTitle('● WhatsApp Web'), 1, 'WhatsApp bullet failed');
    assert.strictEqual(parseUnreadFromTitle('(99+) Telegram Web'), 99, 'Telegram (99+) failed');
    assert.strictEqual(parseUnreadFromTitle('(2) Instagram'), 2, 'Instagram (2) failed');
    assert.strictEqual(parseUnreadFromTitle('(5) Threads'), 5, 'Threads (5) failed');
    assert.strictEqual(parseUnreadFromTitle('Inbox (4) - user@gmail.com', SERVICES_CONFIG.gmail.titleBadgeRegex), 4, 'Gmail (4) failed');
    assert.strictEqual(parseUnreadFromTitle('Inbox (99+) - user@gmail.com', SERVICES_CONFIG.gmail.titleBadgeRegex), 99, 'Gmail (99+) failed');
    assert.strictEqual(parseUnreadFromTitle('WhatsApp'), 0, 'Clean WhatsApp title failed');
    assert.strictEqual(parseUnreadFromTitle(''), 0, 'Empty title failed');
    console.log('   ✅ All 12 title badge patterns successfully parsed by production parser!');

    // --- TEST 3: Navigation Security & URL Policies ---
    console.log('\\n3️⃣  Verifying Production URL Validation & Adversarial Tests...');
    const wa = SERVICES_CONFIG.whatsapp;
    const discord = SERVICES_CONFIG.discord;
    const gmail = SERVICES_CONFIG.gmail;

    // Approved HTTPS destinations
    assert.strictEqual(isUrlAllowed('https://web.whatsapp.com', wa), true, 'Allowed WhatsApp root');
    assert.strictEqual(isUrlAllowed('https://web.whatsapp.com/send?phone=123', wa), true, 'Allowed WhatsApp path');
    assert.strictEqual(isUrlAllowed('https://discord.com/channels/@me', discord), true, 'Allowed Discord app');
    assert.strictEqual(isUrlAllowed('https://mail.google.com/mail/u/0/#inbox', gmail), true, 'Allowed Gmail inbox');
    assert.strictEqual(isUrlAllowed('about:blank', wa), true, 'about:blank allowed');

    // Adversarial / Malicious URLs
    assert.strictEqual(isUrlAllowed('http://web.whatsapp.com', wa), false, 'Plain HTTP rejected');
    assert.strictEqual(isUrlAllowed('https://evil.com', wa), false, 'Untrusted domain rejected');
    assert.strictEqual(isUrlAllowed('https://web.whatsapp.com.attacker.com', wa), false, 'Lookalike subdomain rejected');
    assert.strictEqual(isUrlAllowed('https://evil-whatsapp.com', wa), false, 'Lookalike prefix rejected');
    assert.strictEqual(isUrlAllowed('https://attacker.com/?redirect=web.whatsapp.com', wa), false, 'Open redirect destination rejected');
    assert.strictEqual(isUrlAllowed('javascript:alert(1)', wa), false, 'javascript: scheme rejected');
    assert.strictEqual(isUrlAllowed('data:text/html,<h1>bad</h1>', wa), false, 'data: scheme rejected');
    assert.strictEqual(isUrlAllowed('file:///etc/passwd', wa), false, 'file: scheme rejected');
    assert.strictEqual(isUrlAllowed('calculator://run', wa), false, 'calculator: scheme rejected');
    assert.strictEqual(isUrlAllowed('ms-msdt://run', wa), false, 'ms-msdt: scheme rejected');
    assert.strictEqual(isUrlAllowed('not-a-url', wa), false, 'Malformed URL rejected');
    assert.strictEqual(isUrlAllowed('', wa), false, 'Empty URL rejected');
    console.log('   ✅ Adversarial URL tests passed (HTTPS enforced, schemes restricted, lookalikes blocked)!');

    // --- TEST 4: safeOpenExternal Protocol Validation ---
    console.log('\\n4️⃣  Verifying safeOpenExternal Protocol Hardening...');
    assert.strictEqual(await safeOpenExternal('file:///etc/passwd'), false, 'file: protocol must be blocked');
    assert.strictEqual(await safeOpenExternal('javascript:alert(1)'), false, 'javascript: protocol must be blocked');
    assert.strictEqual(await safeOpenExternal('ms-msdt://id'), false, 'ms-msdt: protocol must be blocked');
    assert.strictEqual(await safeOpenExternal('calculator://id'), false, 'calculator: protocol must be blocked');
    assert.strictEqual(await safeOpenExternal(''), false, 'Empty URL must be blocked');
    console.log('   ✅ safeOpenExternal correctly rejects non-web OS protocol execution!');

    // --- TEST 5: Input Sanitization ---
    console.log('\\n5️⃣  Verifying Input Sanitization...');
    assert.strictEqual(sanitizeBadgeCount(5), 5);
    assert.strictEqual(sanitizeBadgeCount(999999), 99999);
    assert.strictEqual(sanitizeBadgeCount(-3), 0);
    assert.strictEqual(sanitizeBadgeCount(NaN), 0);
    assert.strictEqual(sanitizeBadgeCount('invalid'), 0);

    const validPayload = sanitizeNotificationPayload({ title: 'New Message', body: 'Hello world', icon: 'https://example.com/icon.png' });
    assert.ok(validPayload);
    assert.strictEqual(validPayload.title, 'New Message');
    assert.strictEqual(validPayload.body, 'Hello world');

    const invalidPayload = sanitizeNotificationPayload({ title: '', body: '' });
    assert.strictEqual(invalidPayload, null, 'Empty notification rejected');
    assert.strictEqual(sanitizeNotificationPayload(null), null, 'Null notification rejected');
    console.log('   ✅ Input sanitizers passed!');

    // --- TEST 6: Production AppStore Multi-Account Persistence & Restart ---
    console.log('\\n6️⃣  Verifying Production AppStore Multi-Account Persistence & Restart...');
    const testStorePath = path.join(process.cwd(), 'test/test_prod_store.json');
    if (fs.existsSync(testStorePath)) fs.unlinkSync(testStorePath);

    const store = new AppStore(testStorePath);
    const id1 = 'acc_' + crypto.randomUUID();
    const id2 = 'acc_' + crypto.randomUUID();
    const id3 = 'acc_' + crypto.randomUUID();

    // 3 Unique IDs
    assert.notStrictEqual(id1, id2);
    assert.notStrictEqual(id1, id3);
    assert.notStrictEqual(id2, id3);

    // Add 2 WhatsApp accounts + 1 Telegram account
    store.addAccount({
      id: id1,
      serviceId: 'whatsapp',
      label: 'Personal WhatsApp',
      color: '#25D366',
      order: 0,
      isMuted: false,
      isHibernated: false,
      unreadCount: 3,
      createdAt: Date.now()
    });

    store.addAccount({
      id: id2,
      serviceId: 'whatsapp',
      label: 'Work WhatsApp',
      color: '#10b981',
      order: 1,
      isMuted: true,
      isHibernated: false,
      unreadCount: 7,
      createdAt: Date.now() + 1
    });

    store.addAccount({
      id: id3,
      serviceId: 'telegram',
      label: 'Personal Telegram',
      color: '#2AABEE',
      order: 2,
      isMuted: false,
      isHibernated: false,
      unreadCount: 1,
      createdAt: Date.now() + 2
    });

    store.setActiveAccountId(id3);

    assert.strictEqual(store.getAccounts().length, 3, 'Store must contain 3 accounts');
    assert.strictEqual(store.getActiveAccountId(), id3, 'Active account set');
    console.log('   ✅ 3 accounts created in production AppStore:');
    console.log('      Account 1 (WhatsApp):', id1);
    console.log('      Account 2 (WhatsApp):', id2);
    console.log('      Account 3 (Telegram):', id3);

    // Simulate App Restart by reloading from disk
    console.log('   🔄 Simulating app restart with a fresh AppStore instance from disk...');
    const reloadedStore = new AppStore(testStorePath);
    const reloadedAccounts = reloadedStore.getAccounts();

    assert.strictEqual(reloadedAccounts.length, 3, 'Must have 3 accounts after restart');
    assert.strictEqual(reloadedAccounts[0].id, id1);
    assert.strictEqual(reloadedAccounts[0].label, 'Personal WhatsApp');
    assert.strictEqual(reloadedAccounts[1].id, id2);
    assert.strictEqual(reloadedAccounts[1].label, 'Work WhatsApp');
    assert.strictEqual(reloadedAccounts[1].isMuted, true);
    assert.strictEqual(reloadedAccounts[2].id, id3);
    assert.strictEqual(reloadedStore.getActiveAccountId(), id3, 'Active account preserved');
    console.log('   ✅ Production AppStore persistence verified across restart!');

    // --- TEST 7: NotificationBridge Routing & Muting ---
    console.log('\\n7️⃣  Verifying NotificationBridge Muting & Delivery Rules...');
    const dummyWindow = new BrowserWindow({ show: false, width: 800, height: 600 });
    const notificationBridge = new NotificationBridge(dummyWindow, store);

    // Account 1 (unmuted) should deliver
    assert.strictEqual(
      notificationBridge.shouldDeliverNotification({ accountId: id1, serviceId: 'whatsapp', title: 'Hi', body: 'Msg' }),
      true,
      'Unmuted account should deliver notification'
    );

    // Account 2 (muted) must be blocked
    assert.strictEqual(
      notificationBridge.shouldDeliverNotification({ accountId: id2, serviceId: 'whatsapp', title: 'Work', body: 'Urgent' }),
      false,
      'Muted account must not deliver notification'
    );

    // Enable global mute -> all blocked
    store.updateSettings({ globalMute: true });
    assert.strictEqual(
      notificationBridge.shouldDeliverNotification({ accountId: id1, serviceId: 'whatsapp', title: 'Hi', body: 'Msg' }),
      false,
      'Global mute must block notifications for all accounts'
    );
    store.updateSettings({ globalMute: false });
    console.log('   ✅ Account-level and global muting verified!');

    // --- TEST 8: Session Isolation & On-Disk Storage Erasure ---
    console.log('\\n8️⃣  Verifying Session Partitions & Complete Storage Data Erasure...');
    const sessionManager = SessionManager.getInstance();

    const acc1 = store.getAccount(id1);
    const acc2 = store.getAccount(id2);
    const acc3 = store.getAccount(id3);

    const s1 = sessionManager.getOrCreateSession(acc1);
    const s2 = sessionManager.getOrCreateSession(acc2);
    const s3 = sessionManager.getOrCreateSession(acc3);

    assert.notStrictEqual(s1, s2, 'Sessions for 2 WhatsApp accounts must be distinct');
    assert.notStrictEqual(s1, s3, 'Sessions for WhatsApp and Telegram must be distinct');
    assert.notStrictEqual(s2, s3, 'Sessions for WhatsApp 2 and Telegram must be distinct');

    // Write a cookie to session 1 to test storage data erasure
    await s1.cookies.set({
      url: 'https://web.whatsapp.com',
      name: 'unibox_test_session',
      value: 'active_session_token_12345'
    });
    const cookiesBefore = await s1.cookies.get({ url: 'https://web.whatsapp.com' });
    assert.strictEqual(cookiesBefore.length >= 1, true, 'Cookie must exist before erasure');

    // Test eraseSession: wipes cookies, cache, indexeddb, and deletes from map
    console.log('   Testing SessionManager.eraseSession data wipe...');
    await sessionManager.eraseSession(acc1);

    const cookiesAfter = await s1.cookies.get({ url: 'https://web.whatsapp.com' });
    assert.strictEqual(cookiesAfter.length, 0, 'Cookies must be erased completely from disk');
    console.log('   ✅ Session partition data completely wiped from disk upon removal!');

    // --- TEST 9: ViewManager Lifecycle & Modal Occlusion Fix ---
    console.log('\\n9️⃣  Verifying ViewManager Lifecycle & WebContentsView Occlusion Handling...');
    const viewManager = new ViewManager(dummyWindow, sessionManager, notificationBridge);

    const view1 = viewManager.getOrCreateView(acc1);
    const view2 = viewManager.getOrCreateView(acc2);
    assert.notStrictEqual(view1, view2, 'WebContentsView instances must be distinct');

    // Select account 1
    viewManager.selectAccount(acc1);
    assert.strictEqual(dummyWindow.contentView.children.length, 1);
    assert.strictEqual(dummyWindow.contentView.children[0], view1);

    // Switch to account 2
    viewManager.selectAccount(acc2);
    assert.strictEqual(dummyWindow.contentView.children.length, 1);
    assert.strictEqual(dummyWindow.contentView.children[0], view2);

    // Modal occlusion fix: setViewsVisible(false) zeroes bounds
    viewManager.setViewsVisible(false);
    assert.deepStrictEqual(view2.getBounds(), { x: 0, y: 0, width: 0, height: 0 });

    // Restore views visible
    viewManager.setViewsVisible(true);
    assert.strictEqual(view2.getBounds().width > 0, true);

    // Hibernation & Waking
    console.log('   Testing ViewManager hibernation and waking...');
    viewManager.hibernateAccount(acc2);
    assert.strictEqual(dummyWindow.contentView.children.length, 0, 'Hibernated view detached');

    viewManager.wakeAccount(acc2);
    assert.strictEqual(dummyWindow.contentView.children.length, 1, 'Woken view reattached');

    // Clean up
    viewManager.removeAccount(acc1.id);
    viewManager.removeAccount(acc2.id);
    if (fs.existsSync(testStorePath)) fs.unlinkSync(testStorePath);
    dummyWindow.destroy();

    console.log('   ✅ ViewManager lifecycle, hibernation, and visibility verified!');

    // --- TEST 10: IPC Sender Validation ---
    console.log('\\n🔟  Verifying IPC Sender Validation Guard...');
    let rejectedForeignSender = false;
    try {
      assertTrustedRenderer(
        { sender: { id: 99999 }, senderFrame: null },
        dummyWindow
      );
    } catch (err) {
      rejectedForeignSender = true;
    }
    assert.strictEqual(rejectedForeignSender, true, 'Foreign IPC sender must be rejected');
    console.log('   ✅ assertTrustedRenderer rejected unauthorized sender!');

    console.log('\\n🎉 All Electron In-Process Verification Tests Passed Successfully!');
    app.exit(0);
  } catch (error) {
    console.error('\\n❌ Verification Test Error:', error);
    app.exit(1);
  }
});
`;

const tempTestRunner = path.join(__dirname, 'temp_verify_runner.js')
fs.writeFileSync(tempTestRunner, electronRunnerScript)

const result = spawnSync(electronPath, ['--no-sandbox', tempTestRunner], {
  encoding: 'utf-8',
  env: { ...process.env, DISPLAY: process.env.DISPLAY || ':0' }
})

if (fs.existsSync(tempTestRunner)) fs.unlinkSync(tempTestRunner)

if (result.status !== 0) {
  console.error(result.stderr || result.stdout)
  throw new Error(`Electron verification failed with exit code ${result.status}`)
} else {
  // Print output
  console.log(result.stdout)
}

// 11. Verify Build Distribution Artifacts
console.log('1️⃣1️⃣  Verifying Build Distribution Files...')
const expectedOutputs = [
  'out/main/index.js',
  'out/main/testExports.js',
  'out/preload/index.js',
  'out/preload/service.js',
  'out/renderer/index.html'
]

for (const outPath of expectedOutputs) {
  const fullPath = path.join(__dirname, '..', outPath)
  assert.ok(fs.existsSync(fullPath), `Artifact must exist: ${outPath}`)
  const stat = fs.statSync(fullPath)
  console.log(`   ✅ ${outPath} (${(stat.size / 1024).toFixed(2)} KB)`)
}

console.log('\n🎉 ALL PHASE 1 INTEGRATION, SECURITY & MULTI-ACCOUNT VERIFICATION TESTS PASSED!\n')
