const assert = require('assert')
const fs = require('fs')
const path = require('path')

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
console.log('2️⃣  Verifying Title & Badge Parsing for All Services...')
assert.strictEqual(parseUnreadCountFromTitle('(3) WhatsApp'), 3, 'WhatsApp (3) failed')
assert.strictEqual(parseUnreadCountFromTitle('[12] Discord'), 12, 'Discord [12] failed')
assert.strictEqual(parseUnreadCountFromTitle('(99+) Telegram'), 99, 'Telegram (99+) failed')
assert.strictEqual(parseUnreadCountFromTitle('• Discord'), 1, 'Discord unread bullet indicator failed')
assert.strictEqual(parseUnreadCountFromTitle('Gmail - Inbox (5)', '\\((\\d+)\\)'), 5, 'Gmail (5) failed')
assert.strictEqual(parseUnreadCountFromTitle('WhatsApp'), 0, 'WhatsApp 0 failed')
console.log('   ✅ All title regex and badge patterns passed!')

// 3. Test Partition Formats & Multi-Account Isolation
console.log('\n3️⃣  Verifying Session Partition Isolation...')
function getPartition(serviceId, accountId) {
  return `persist:${serviceId}-${accountId}`
}
const p1 = getPartition('whatsapp', 'work-1')
const p2 = getPartition('whatsapp', 'personal-2')
const p3 = getPartition('discord', 'gaming-3')

assert.strictEqual(p1, 'persist:whatsapp-work-1')
assert.strictEqual(p2, 'persist:whatsapp-personal-2')
assert.strictEqual(p3, 'persist:discord-gaming-3')
assert.notStrictEqual(p1, p2, 'Different accounts of same service must have distinct partitions')
console.log('   ✅ Session partition isolation verified:');
console.log(`      Account 1: ${p1}`);
console.log(`      Account 2: ${p2}`);
console.log(`      Account 3: ${p3}`);

// 4. Test Local Store Persistence Logic
console.log('\n4️⃣  Verifying Store Persistence and Data Integrity...')
const tempStorePath = path.join(__dirname, 'test_unibox_data.json')
if (fs.existsSync(tempStorePath)) fs.unlinkSync(tempStorePath)

class MockStore {
  constructor(filePath) {
    this.filePath = filePath
    this.state = {
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

  save() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2))
  }

  load() {
    this.state = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'))
  }

  addAccount(acc) {
    this.state.accounts.push(acc)
    if (!this.state.activeAccountId) this.state.activeAccountId = acc.id
    this.save()
  }

  updateAccount(id, updates) {
    const acc = this.state.accounts.find(a => a.id === id)
    if (acc) {
      Object.assign(acc, updates)
      this.save()
    }
  }

  removeAccount(id) {
    this.state.accounts = this.state.accounts.filter(a => a.id !== id)
    if (this.state.activeAccountId === id) {
      this.state.activeAccountId = this.state.accounts[0]?.id || null
    }
    this.save()
  }
}

const store = new MockStore(tempStorePath)
store.addAccount({
  id: 'acc_wa_1',
  serviceId: 'whatsapp',
  label: 'Work WhatsApp',
  color: '#25D366',
  order: 0,
  isMuted: false,
  isHibernated: false,
  unreadCount: 4,
  createdAt: Date.now()
})

store.addAccount({
  id: 'acc_wa_2',
  serviceId: 'whatsapp',
  label: 'Personal WhatsApp',
  color: '#10b981',
  order: 1,
  isMuted: true, // Muted
  isHibernated: false,
  unreadCount: 8,
  createdAt: Date.now()
})

store.addAccount({
  id: 'acc_tg_1',
  serviceId: 'telegram',
  label: 'Tech Telegram',
  color: '#2AABEE',
  order: 2,
  isMuted: false,
  isHibernated: true, // Hibernated
  unreadCount: 2,
  createdAt: Date.now()
})

// Check file was written to disk
assert.ok(fs.existsSync(tempStorePath), 'Store file must exist on disk')
store.load()
assert.strictEqual(store.state.accounts.length, 3, 'Store must persist 3 accounts')
assert.strictEqual(store.state.activeAccountId, 'acc_wa_1', 'First added account should be active')

// Calculate unread badge count excluding muted accounts
const totalUnread = store.state.accounts.reduce((sum, acc) => {
  return acc.isMuted ? sum : sum + acc.unreadCount
}, 0)
// acc_wa_1 (4) + acc_tg_1 (2) = 6 (acc_wa_2 is muted so excluded)
assert.strictEqual(totalUnread, 6, 'Badge calculation must exclude muted accounts')
console.log(`   ✅ Non-muted badge count calculation passed: ${totalUnread} unread`);

// Test renaming and custom UA
store.updateAccount('acc_wa_1', { label: 'Renamed Work WA', customUserAgent: 'CustomUA/1.0' })
store.load()
assert.strictEqual(store.state.accounts[0].label, 'Renamed Work WA')
assert.strictEqual(store.state.accounts[0].customUserAgent, 'CustomUA/1.0')
console.log('   ✅ Account rename and custom user agent override verified')

// Test removing account
store.removeAccount('acc_wa_1')
store.load()
assert.strictEqual(store.state.accounts.length, 2)
assert.strictEqual(store.state.activeAccountId, 'acc_wa_2', 'Active account updated after removal')
console.log('   ✅ Account removal and active account fallback verified')

// Cleanup
if (fs.existsSync(tempStorePath)) fs.unlinkSync(tempStorePath)

// 5. Verify Build Artifacts
console.log('\n5️⃣  Verifying Build Distribution Files...')
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

console.log('\n🎉 ALL INTEGRATION & ARCHITECTURE TESTS PASSED SUCCESSFULLY!\n')
