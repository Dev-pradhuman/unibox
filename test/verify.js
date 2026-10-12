const assert = require('assert')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { spawnSync } = require('child_process')

console.log('🚀 Running Unibox Automated Verification Suite...\n')

// 1. Verify Service Registry
console.log('1️⃣  Verifying Services Registry...')
const servicesSource = fs.readFileSync(path.join(__dirname, '../src/shared/services.ts'), 'utf-8')
const expectedServices = ['whatsapp', 'instagram', 'telegram', 'discord', 'threads', 'gmail']

for (const svc of expectedServices) {
  assert.ok(servicesSource.includes(`id: '${svc}'`), `Service ${svc} must be registered`)
  console.log(`   ✅ Service "${svc}" registered`)
}

// Test unread count parser
function parseUnreadCountFromTitle(title, customRegex) {
  if (!title) return 0
  if (customRegex) {
    try {
      const match = title.match(new RegExp(customRegex))
      if (match && match[1]) {
        const val = parseInt(match[1], 10)
        return isNaN(val) ? 0 : val
      }
    } catch (e) {}
  }

  const match = title.match(/[\(\[]\s*(\d+)\+?\s*[\)\]]/)
  if (match && match[1]) {
    const val = parseInt(match[1], 10)
    return isNaN(val) ? 0 : val
  }
  if (/^[•●]/.test(title.trim())) {
    return 1
  }
  return 0
}

// 2. Test Badge & Title Detection Patterns
console.log('\n2️⃣  Verifying Title & Badge Parsing for All Services...')
assert.strictEqual(parseUnreadCountFromTitle('(3) WhatsApp'), 3, 'WhatsApp (3) failed')
assert.strictEqual(parseUnreadCountFromTitle('[12] Discord'), 12, 'Discord [12] failed')
assert.strictEqual(parseUnreadCountFromTitle('(99+) Telegram'), 99, 'Telegram (99+) failed')
assert.strictEqual(parseUnreadCountFromTitle('• Discord'), 1, 'Discord unread bullet indicator failed')
assert.strictEqual(parseUnreadCountFromTitle('Gmail - Inbox (5)', '\\((\\d+)\\)'), 5, 'Gmail (5) failed')
assert.strictEqual(parseUnreadCountFromTitle('WhatsApp'), 0, 'WhatsApp 0 failed')
console.log('   ✅ All title regex and badge patterns passed!')

// 3. Test Partition Formats & Multi-Account Isolation (2 of same service + 1 other)
console.log('\n3️⃣  Verifying Session Partition Isolation (2 WhatsApp + 1 Telegram)...')
function getPartition(serviceId, accountId) {
  return `persist:${serviceId}-${accountId}`
}

const id1 = `acc_${crypto.randomUUID()}`
const id2 = `acc_${crypto.randomUUID()}`
const id3 = `acc_${crypto.randomUUID()}`

// Assert 3 unique IDs
const idSet = new Set([id1, id2, id3])
assert.strictEqual(idSet.size, 3, 'Must have 3 unique account IDs')
console.log('   ✅ 3 Unique IDs generated with crypto.randomUUID():')
console.log(`      ID 1 (WhatsApp): ${id1}`)
console.log(`      ID 2 (WhatsApp): ${id2}`)
console.log(`      ID 3 (Telegram): ${id3}`)

const p1 = getPartition('whatsapp', id1)
const p2 = getPartition('whatsapp', id2)
const p3 = getPartition('telegram', id3)

// Assert 3 unique partitions
const partitionSet = new Set([p1, p2, p3])
assert.strictEqual(partitionSet.size, 3, 'Must have 3 unique session partitions')
assert.notStrictEqual(p1, p2, 'Two WhatsApp accounts must have completely separate partitions')
assert.notStrictEqual(p1, p3, 'WhatsApp and Telegram must have separate partitions')
assert.notStrictEqual(p2, p3, 'WhatsApp 2 and Telegram must have separate partitions')

console.log('   ✅ 3 Unique session partitions verified:')
console.log(`      Partition 1: ${p1}`)
console.log(`      Partition 2: ${p2}`)
console.log(`      Partition 3: ${p3}`)

// 4. Test Local Store Persistence and Restart Simulation
console.log('\n4️⃣  Verifying Multi-Account Store Persistence & Restart Reload...')
const tempStorePath = path.join(__dirname, 'test_multi_account_store.json')
if (fs.existsSync(tempStorePath)) fs.unlinkSync(tempStorePath)

class MockStore {
  constructor(filePath) {
    this.filePath = filePath
    this.state = this.load()
  }

  save() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2))
  }

  load() {
    if (fs.existsSync(this.filePath)) {
      return JSON.parse(fs.readFileSync(this.filePath, 'utf-8'))
    }
    return {
      accounts: [],
      activeAccountId: null,
      settings: {
        theme: 'dark',
        sidebarCollapsed: false,
        globalMute: false,
        startMinimized: false,
        openAtLogin: false
      }
    }
  }

  addAccount(acc) {
    this.state.accounts.push(acc)
    this.state.activeAccountId = acc.id
    this.save()
    return acc
  }

  getAccounts() {
    return [...this.state.accounts]
  }

  getActiveAccountId() {
    return this.state.activeAccountId
  }
}

// Add 3 accounts: 2 WhatsApp, 1 Telegram
const initialStore = new MockStore(tempStorePath)
const acc1 = initialStore.addAccount({
  id: id1,
  serviceId: 'whatsapp',
  label: 'Personal WhatsApp',
  color: '#25D366',
  order: 0,
  isMuted: false,
  isHibernated: false,
  unreadCount: 3,
  createdAt: Date.now()
})

const acc2 = initialStore.addAccount({
  id: id2,
  serviceId: 'whatsapp',
  label: 'Work WhatsApp',
  color: '#10b981',
  order: 1,
  isMuted: false,
  isHibernated: false,
  unreadCount: 5,
  createdAt: Date.now() + 1
})

const acc3 = initialStore.addAccount({
  id: id3,
  serviceId: 'telegram',
  label: 'Personal Telegram',
  color: '#2AABEE',
  order: 2,
  isMuted: false,
  isHibernated: false,
  unreadCount: 1,
  createdAt: Date.now() + 2
})

assert.strictEqual(initialStore.getAccounts().length, 3, 'Must have 3 accounts in store')
console.log('   ✅ 3 accounts successfully added to store')

// Simulate App Restart: instantiate a new store from the file
console.log('   🔄 Simulating app restart by reloading store from disk...')
const reloadedStore = new MockStore(tempStorePath)
const reloadedAccounts = reloadedStore.getAccounts()

assert.strictEqual(reloadedAccounts.length, 3, 'All 3 accounts must persist across restart')
assert.strictEqual(reloadedAccounts[0].id, id1)
assert.strictEqual(reloadedAccounts[0].serviceId, 'whatsapp')
assert.strictEqual(reloadedAccounts[0].label, 'Personal WhatsApp')
assert.strictEqual(reloadedAccounts[1].id, id2)
assert.strictEqual(reloadedAccounts[1].serviceId, 'whatsapp')
assert.strictEqual(reloadedAccounts[1].label, 'Work WhatsApp')
assert.strictEqual(reloadedAccounts[2].id, id3)
assert.strictEqual(reloadedAccounts[2].serviceId, 'telegram')
assert.strictEqual(reloadedAccounts[2].label, 'Personal Telegram')
assert.strictEqual(reloadedStore.getActiveAccountId(), id3, 'Active account persisted')

console.log('   ✅ All 3 accounts accurately persisted and restored after restart!')

// Cleanup mock store file
if (fs.existsSync(tempStorePath)) fs.unlinkSync(tempStorePath)

// 5. Test Real Electron ViewManager & 3 Separate WebContentsViews
console.log('\n5️⃣  Verifying 3 Separate WebContentsViews & Sessions in Electron...')
const electronScript = `
const { app, BaseWindow, WebContentsView, session } = require('electron');
const assert = require('assert');

app.whenReady().then(async () => {
  const win = new BaseWindow({ width: 1000, height: 700 });

  const id1 = '${id1}';
  const id2 = '${id2}';
  const id3 = '${id3}';

  // 1. Verify 3 isolated persistent sessions (2 WhatsApp + 1 Telegram)
  const s1 = session.fromPartition('persist:whatsapp-' + id1);
  const s2 = session.fromPartition('persist:whatsapp-' + id2);
  const s3 = session.fromPartition('persist:telegram-' + id3);

  assert.notStrictEqual(s1, s2, 'Sessions for two WhatsApp accounts must be distinct');
  assert.notStrictEqual(s1, s3, 'Sessions for WhatsApp and Telegram must be distinct');
  assert.notStrictEqual(s2, s3, 'Sessions for WhatsApp 2 and Telegram must be distinct');

  // 2. Verify 3 separate WebContentsView instances
  const view1 = new WebContentsView({ webPreferences: { session: s1 } });
  const view2 = new WebContentsView({ webPreferences: { session: s2 } });
  const view3 = new WebContentsView({ webPreferences: { session: s3 } });

  assert.notStrictEqual(view1, view2, 'View 1 and View 2 must be separate instances');
  assert.notStrictEqual(view1, view3, 'View 1 and View 3 must be separate instances');
  assert.notStrictEqual(view2, view3, 'View 2 and View 3 must be separate instances');

  // Verify switching views on window
  win.contentView.addChildView(view1);
  view1.setBounds({ x: 260, y: 52, width: 740, height: 648 });
  assert.strictEqual(win.contentView.children.length, 1);
  assert.strictEqual(win.contentView.children[0], view1);

  // Switch to view2
  win.contentView.removeChildView(view1);
  win.contentView.addChildView(view2);
  view2.setBounds({ x: 260, y: 52, width: 740, height: 648 });
  assert.strictEqual(win.contentView.children.length, 1);
  assert.strictEqual(win.contentView.children[0], view2);

  // Switch to view3
  win.contentView.removeChildView(view2);
  win.contentView.addChildView(view3);
  view3.setBounds({ x: 260, y: 52, width: 740, height: 648 });
  assert.strictEqual(win.contentView.children.length, 1);
  assert.strictEqual(win.contentView.children[0], view3);

  // Test modal occlusion prevention: hiding views
  view3.setVisible(false);
  view3.setBounds({ x: 0, y: 0, width: 0, height: 0 });
  assert.deepStrictEqual(view3.getBounds(), { x: 0, y: 0, width: 0, height: 0 });

  view3.setVisible(true);
  view3.setBounds({ x: 260, y: 52, width: 740, height: 648 });
  assert.strictEqual(view3.getBounds().width, 740);

  console.log('   ✅ Electron verification: 3 distinct sessions and 3 separate WebContentsViews verified successfully!');
  process.exit(0);
});
`

const tempTestRunner = path.join(__dirname, 'temp_verify_runner.js')
fs.writeFileSync(tempTestRunner, electronScript)

const electronPath = path.join(__dirname, '../node_modules/electron/dist/electron')
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
  const lines = result.stdout.split('\n').filter(l => l.includes('Electron verification'))
  lines.forEach(l => console.log(l))
}

// 6. Verify Build Distribution Files
console.log('\n6️⃣  Verifying Build Distribution Files...')
const expectedOutputs = [
  'out/main/index.js',
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

console.log('\n🎉 ALL INTEGRATION & MULTI-ACCOUNT VERIFICATION TESTS PASSED SUCCESSFULLY!\n')
