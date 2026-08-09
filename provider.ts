import { z } from 'zod'
import { dbRequest, runLogged } from './db'

const competitionSchema = z.object({
  id: z.string().uuid(),
  sport_id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  external_provider: z.string(),
  external_id: z.string(),
})

const eventSchema = z.object({
  idEvent: z.string(),
  strEvent: z.string().nullable().optional(),
  strHomeTeam: z.string(),
  strAwayTeam: z.string(),
  idHomeTeam: z.string(),
  idAwayTeam: z.string(),
  strHomeTeamBadge: z.string().url().nullable().optional(),
  strAwayTeamBadge: z.string().url().nullable().optional(),
  strTimestamp: z.string().nullable().optional(),
  dateEvent: z.string().nullable().optional(),
  strTime: z.string().nullable().optional(),
  strStatus: z.string().nullable().optional(),
  strProgress: z.string().nullable().optional(),
  intHomeScore: z.union([z.string(), z.number()]).nullable().optional(),
  intAwayScore: z.union([z.string(), z.number()]).nullable().optional(),
  strVenue: z.string().nullable().optional(),
})

const eventsResponseSchema = z.object({ events: z.array(eventSchema).nullable().default([]) })
const teamResultSchema = z.array(z.object({ id: z.string().uuid() })).length(1)
const manualMatchSchema = z.array(z.object({ external_id: z.string(), manually_corrected: z.boolean() }))
const activeMatchSchema = z.array(z.object({ id: z.string().uuid(), external_id: z.string(), starts_at: z.string().datetime({ offset: true }) }))

type Competition = z.infer<typeof competitionSchema>
type ProviderEvent = z.infer<typeof eventSchema>

function slugify(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function shortName(value: string): string {
  const compact = value.split(/\s+/).map((word) => word[0]).join('').toUpperCase()
  return (compact.length >= 2 ? compact : value.slice(0, 3)).slice(0, 6)
}

function parseStart(event: ProviderEvent): Date | null {
  const candidate = event.strTimestamp || (event.dateEvent && `${event.dateEvent}T${event.strTime || '00:00:00'}Z`)
  if (!candidate) return null
  const date = new Date(candidate)
  return Number.isNaN(date.getTime()) ? null : date
}

function scoreValue(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

function mapStatus(value: string | null | undefined, startsAt: Date): 'scheduled' | 'live' | 'halftime' | 'finished' | 'postponed' | 'cancelled' {
  const status = (value || '').toLowerCase()
  if (/postpon/.test(status)) return 'postponed'
  if (/cancel/.test(status)) return 'cancelled'
  if (/half/.test(status)) return 'halftime'
  if (/finish|match finished|full time|ft/.test(status)) return 'finished'
  if (/live|in progress|1h|2h/.test(status)) return 'live'
  if (startsAt.getTime() < Date.now() - 9 * 60 * 60 * 1000) return 'finished'
  return 'scheduled'
}

async function upsertTeam(env: Env, competition: Competition, name: string, externalId: string, logo: string | null | undefined): Promise<string> {
  const rows = await dbRequest(env, 'teams?on_conflict=external_provider,external_id', teamResultSchema, {
    method: 'POST',
    body: {
      sport_id: competition.sport_id,
      name,
      short_name: shortName(name),
      slug: `${slugify(name)}-${externalId}`,
      logo_url: logo || null,
      external_provider: 'thesportsdb',
      external_id: externalId,
      active: true,
    },
    prefer: 'resolution=merge-duplicates,return=representation',
  })
  return rows[0].id
}

async function syncCompetition(env: Env, competition: Competition, apiKey: string): Promise<number> {
  const response = await fetch(`${env.SPORTS_API_BASE}/${encodeURIComponent(apiKey)}/eventsnextleague.php?id=${encodeURIComponent(competition.external_id)}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'Live-Sports-TV/1.0' },
    signal: AbortSignal.timeout(12_000),
  })
  if (!response.ok) throw new Error(`Sports provider returned ${response.status} for ${competition.name}`)
  const { events } = eventsResponseSchema.parse(await response.json())
  if (!events?.length) return 0

  const ids = events.map((event) => event.idEvent)
  const existing = await dbRequest(
    env,
    `matches?external_provider=eq.thesportsdb&external_id=in.(${ids.map(encodeURIComponent).join(',')})&select=external_id,manually_corrected`,
    manualMatchSchema,
  )
  const protectedIds = new Set(existing.filter((match) => match.manually_corrected).map((match) => match.external_id))
  let processed = 0
  for (const event of events) {
    if (protectedIds.has(event.idEvent)) continue
    const startsAt = parseStart(event)
    if (!startsAt) continue
    const [homeTeamId, awayTeamId] = await Promise.all([
      upsertTeam(env, competition, event.strHomeTeam, event.idHomeTeam, event.strHomeTeamBadge),
      upsertTeam(env, competition, event.strAwayTeam, event.idAwayTeam, event.strAwayTeamBadge),
    ])
    await dbRequest(env, 'matches?on_conflict=external_provider,external_id', z.undefined(), {
      method: 'POST',
      body: {
        competition_id: competition.id,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        slug: `${slugify(event.strHomeTeam)}-v-${slugify(event.strAwayTeam)}-${event.idEvent}`,
        title: event.strEvent || null,
        external_provider: 'thesportsdb',
        external_id: event.idEvent,
        starts_at: startsAt.toISOString(),
        ends_at: new Date(startsAt.getTime() + 3 * 60 * 60 * 1000).toISOString(),
        status: mapStatus(event.strStatus, startsAt),
        home_score: scoreValue(event.intHomeScore),
        away_score: scoreValue(event.intAwayScore),
        venue: event.strVenue || null,
        last_synced_at: new Date().toISOString(),
        is_demo: false,
      },
      prefer: 'resolution=merge-duplicates,return=minimal',
    })
    processed += 1
  }
  return processed
}

async function refreshActiveMatches(env: Env, apiKey: string): Promise<number> {
  const from = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
  const to = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
  const matches = await dbRequest(
    env,
    `matches?external_provider=eq.thesportsdb&external_id=not.is.null&manually_corrected=eq.false&status=in.(scheduled,live,halftime)&starts_at=gte.${encodeURIComponent(from)}&starts_at=lte.${encodeURIComponent(to)}&select=id,external_id,starts_at`,
    activeMatchSchema,
  )
  let refreshed = 0
  for (const match of matches) {
    const response = await fetch(`${env.SPORTS_API_BASE}/${encodeURIComponent(apiKey)}/lookupevent.php?id=${encodeURIComponent(match.external_id)}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Live-Sports-TV/1.0' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) throw new Error(`Sports provider live refresh returned ${response.status}`)
    const event = eventsResponseSchema.parse(await response.json()).events?.[0]
    if (!event) continue
    const startsAt = parseStart(event) ?? new Date(match.starts_at)
    await dbRequest(env, `matches?id=eq.${encodeURIComponent(match.id)}`, z.undefined(), {
      method: 'PATCH',
      body: {
        status: mapStatus(event.strStatus || event.strProgress, startsAt),
        home_score: scoreValue(event.intHomeScore),
        away_score: scoreValue(event.intAwayScore),
        clock: event.strProgress || event.strStatus || null,
        venue: event.strVenue || null,
        last_synced_at: new Date().toISOString(),
      },
      prefer: 'return=minimal',
    })
    refreshed += 1
  }
  return refreshed
}

export async function refreshLiveFixtures(env: Env): Promise<number> {
  return runLogged(env, 'live_fixture_refresh', env.SPORTS_PROVIDER, async () => {
    if (!env.SPORTS_API_KEY) return { value: 0, count: 0 }
    const count = await refreshActiveMatches(env, env.SPORTS_API_KEY)
    return { value: count, count }
  })
}

export async function syncFixtures(env: Env): Promise<number> {
  return runLogged(env, 'fixture_sync', env.SPORTS_PROVIDER, async () => {
    if (!env.SPORTS_API_KEY) return { value: 0, count: 0 }
    const competitions = await dbRequest(
      env,
      'competitions?active=eq.true&external_provider=eq.thesportsdb&external_id=not.is.null&select=id,sport_id,name,slug,external_provider,external_id',
      z.array(competitionSchema),
    )
    let count = await refreshActiveMatches(env, env.SPORTS_API_KEY)
    for (const competition of competitions) count += await syncCompetition(env, competition, env.SPORTS_API_KEY)
    return { value: count, count }
  })
}
