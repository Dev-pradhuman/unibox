import { ServiceDefinition, ServiceId } from './types'

export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

export const SERVICES_CONFIG: Record<ServiceId, ServiceDefinition> = {
  whatsapp: {
    id: 'whatsapp',
    name: 'WhatsApp',
    url: 'https://web.whatsapp.com',
    allowedDomains: ['web.whatsapp.com', 'whatsapp.com', 'whatsapp.net', 'facebook.com'],
    icon: 'MessageSquare',
    themeColor: '#25D366',
    titleBadgeRegex: '^\\((\\d+)\\)',
    defaultUserAgent: DEFAULT_USER_AGENT,
    description: 'WhatsApp Web messaging'
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram DMs',
    url: 'https://www.instagram.com/direct/inbox/',
    allowedDomains: ['instagram.com', 'www.instagram.com', 'facebook.com', 'fbcdn.net'],
    icon: 'Camera',
    themeColor: '#E1306C',
    titleBadgeRegex: '^\\((\\d+)\\)',
    defaultUserAgent: DEFAULT_USER_AGENT,
    description: 'Instagram Direct Messages'
  },
  telegram: {
    id: 'telegram',
    name: 'Telegram',
    url: 'https://web.telegram.org/k/',
    allowedDomains: ['web.telegram.org', 'telegram.org', 'telegram.me', 't.me'],
    icon: 'Send',
    themeColor: '#2AABEE',
    titleBadgeRegex: '^\\((\\d+)\\)',
    defaultUserAgent: DEFAULT_USER_AGENT,
    description: 'Telegram Web K client'
  },
  discord: {
    id: 'discord',
    name: 'Discord',
    url: 'https://discord.com/app',
    allowedDomains: ['discord.com', 'discordapp.com', 'discord.gg', 'discord.media'],
    icon: 'Headphones',
    themeColor: '#5865F2',
    titleBadgeRegex: '^\\((\\d+)\\)',
    defaultUserAgent: DEFAULT_USER_AGENT,
    description: 'Discord Web App'
  },
  threads: {
    id: 'threads',
    name: 'Threads',
    url: 'https://www.threads.net',
    allowedDomains: ['threads.net', 'www.threads.net', 'instagram.com'],
    icon: 'AtSign',
    themeColor: '#000000',
    titleBadgeRegex: '^\\((\\d+)\\)',
    defaultUserAgent: DEFAULT_USER_AGENT,
    description: 'Threads by Instagram'
  },
  gmail: {
    id: 'gmail',
    name: 'Gmail',
    url: 'https://mail.google.com',
    allowedDomains: [
      'mail.google.com',
      'accounts.google.com',
      'google.com',
      'gstatic.com',
      'googleusercontent.com'
    ],
    icon: 'Mail',
    themeColor: '#EA4335',
    titleBadgeRegex: '\\((\\d+)\\)',
    defaultUserAgent: DEFAULT_USER_AGENT,
    description: 'Google Mail'
  }
}

export const SERVICES_LIST = Object.values(SERVICES_CONFIG)
