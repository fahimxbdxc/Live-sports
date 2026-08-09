export interface ScoreableMatch {
  startsAt: string
  competition: string
  homeTeam: string
  awayTeam: string
}

function tokens(value: string) {
  return [...new Set(value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter((token) => token.length > 1))]
}

function coverage(title: string, target: string) {
  const titleTokens = new Set(tokens(title))
  const targetTokens = tokens(target)
  return targetTokens.length ? targetTokens.filter((token) => titleTokens.has(token)).length / targetTokens.length : 0
}

export function calculateDiscoveryScore(match: ScoreableMatch, candidate: { title: string; approvedChannel: boolean; scheduledStart?: string }) {
  let score = Math.round(coverage(candidate.title, match.homeTeam) * 25) + Math.round(coverage(candidate.title, match.awayTeam) * 25) + Math.round(coverage(candidate.title, match.competition) * 20)
  if (candidate.approvedChannel) score += 15
  if (/\blive\b/i.test(candidate.title)) score += 5
  if (candidate.scheduledStart) {
    const delta = Math.abs(new Date(candidate.scheduledStart).getTime() - new Date(match.startsAt).getTime())
    if (delta <= 30 * 60 * 1000) score += 10
    else if (delta <= 90 * 60 * 1000) score += 6
  }
  return Math.min(100, score)
}
