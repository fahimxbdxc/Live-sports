import type { Match, MatchStatus } from '../types'

export function formatLocalDate(value: string, language: 'en' | 'bn' = 'en') {
  return new Intl.DateTimeFormat(language === 'bn' ? 'bn-BD' : 'en-GB', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(value))
}

export function timeUntil(value: string, language: 'en' | 'bn' = 'en') {
  const minutes = Math.max(0, Math.floor((new Date(value).getTime() - Date.now()) / 60000))
  if (minutes < 60) return language === 'bn' ? `${minutes} মিনিট` : `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return language === 'bn' ? `${hours} ঘণ্টা ${minutes % 60} মিনিট` : `${hours}h ${minutes % 60}m`
  const days = Math.floor(hours / 24)
  return language === 'bn' ? `${days} দিন ${hours % 24} ঘণ্টা` : `${days}d ${hours % 24}h`
}

export function matchTitle(match: Match) {
  return match.title || `${match.home_team.name} vs ${match.away_team.name}`
}

export function statusLabel(status: MatchStatus, language: 'en' | 'bn') {
  const labels: Record<MatchStatus, [string, string]> = {
    scheduled: ['Upcoming', 'আসন্ন'], live: ['Live', 'লাইভ'], halftime: ['Half-time', 'বিরতি'],
    finished: ['Full-time', 'শেষ'], postponed: ['Postponed', 'স্থগিত'], cancelled: ['Cancelled', 'বাতিল'],
  }
  return labels[status][language === 'bn' ? 1 : 0]
}

export function isSafeExternalUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:'
  } catch {
    return false
  }
}

export function isSafeEmbedUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && ['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com'].includes(url.hostname)
  } catch {
    return false
  }
}

export function isApprovedEmbedUrl(value: string, approvedDomain: string | undefined) {
  if (!approvedDomain) return false
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return false
    const domain = approvedDomain.toLowerCase().replace(/^www\./, '')
    if (['youtube.com', 'youtu.be'].includes(domain)) return ['www.youtube.com', 'youtube.com', 'm.youtube.com', 'www.youtube-nocookie.com', 'youtu.be'].includes(url.hostname)
    return url.hostname === domain || url.hostname.endsWith(`.${domain}`)
  } catch {
    return false
  }
}
