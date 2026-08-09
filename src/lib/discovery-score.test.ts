import { describe, expect, it } from 'vitest'
import { calculateDiscoveryScore } from './discovery-score'

const match = {
  startsAt: '2026-08-09T18:00:00Z',
  competition: 'Premier League',
  homeTeam: 'Liverpool',
  awayTeam: 'Arsenal',
}

describe('calculateDiscoveryScore', () => {
  it('accepts a precise approved-channel match', () => {
    expect(calculateDiscoveryScore(match, { title: 'Liverpool vs Arsenal | Premier League LIVE', approvedChannel: true, scheduledStart: '2026-08-09T18:00:00Z' })).toBe(100)
  })

  it('rejects an unrelated title even on an approved channel', () => {
    expect(calculateDiscoveryScore(match, { title: 'Chelsea training session live', approvedChannel: true })).toBeLessThan(45)
  })
})
