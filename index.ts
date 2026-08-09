import { z } from 'zod'
import { dbRequest } from './db'
import { discoverOfficialSources } from './discovery'
import { authorizePlayback, recordPlaybackEvent } from './playback'
import { refreshLiveFixtures, syncFixtures } from './provider'
import { corsHeaders, enforceRateLimit, HttpError, originAllowed, requireAdmin } from './security'

const playbackEventSchema = z.object({
  stream_id: z.string().uuid(),
  event_type: z.enum(['requested', 'started', 'error', 'fallback', 'external_open']),
  error_code: z.string().max(120).optional(),
})

function json(request: Request, env: Env, data: unknown, init: ResponseInit = {}): Response {
  const headers = corsHeaders(request, env)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Referrer-Policy', 'no-referrer')
  new Headers(init.headers).forEach((value, name) => headers.set(name, value))
  return Response.json(data, { ...init, headers })
}

async function publicMatches(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const cache = caches.default
  const cacheKey = new Request(new URL('/api/matches', request.url), { method: 'GET' })
  const cached = await cache.match(cacheKey)
  if (cached) return new Response(cached.body, cached)
  const from = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString()
  const to = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString()
  const rows = await dbRequest(env, `matches?starts_at=gte.${encodeURIComponent(from)}&starts_at=lte.${encodeURIComponent(to)}&order=starts_at.asc&limit=150&select=id,slug,title,starts_at,ends_at,status,home_score,away_score,clock,venue,featured,is_demo,home_team:teams!matches_home_team_id_fkey(id,name,short_name,slug,logo_url,country),away_team:teams!matches_away_team_id_fkey(id,name,short_name,slug,logo_url,country),competition:competitions(id,name,slug,country,logo_url,sport:sports(id,name,slug)),match_streams(id,source_type,embed_url,source_page_url,territory,status,priority,expires_at,provider:approved_sources(provider_name,provider_domain,active,permission_status,rights_expiry))`, z.array(z.record(z.string(), z.unknown())))
  const now = Date.now()
  const safeRows = rows.map((row) => ({
    ...row,
    match_streams: (Array.isArray(row.match_streams) ? row.match_streams : []).filter((value): value is Record<string, unknown> => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return false
      const stream = value as Record<string, unknown>
      const provider = stream.provider
      if (!provider || typeof provider !== 'object' || Array.isArray(provider)) return false
      const source = provider as Record<string, unknown>
      const territory = Array.isArray(stream.territory) ? stream.territory : []
      return stream.status === 'active'
        && (!stream.expires_at || (typeof stream.expires_at === 'string' && new Date(stream.expires_at).getTime() > now))
        && (territory.includes('BD') || territory.includes('GLOBAL'))
        && source.active === true
        && source.permission_status === 'approved'
        && typeof source.rights_expiry === 'string'
        && new Date(source.rights_expiry).getTime() > now
    }).map((stream) => ({ ...stream, provider: { provider_name: (stream.provider as Record<string, unknown>).provider_name, provider_domain: (stream.provider as Record<string, unknown>).provider_domain } })),
  }))
  const response = json(request, env, safeRows, { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=120' } })
  ctx.waitUntil(cache.put(cacheKey, response.clone()))
  return response
}

async function handleRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (!originAllowed(request, env)) throw new HttpError(403, 'Origin is not allowed')
  const url = new URL(request.url)
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) })
  if (url.pathname === '/__scheduled' && env.ENVIRONMENT === 'production') throw new HttpError(404, 'Not found')
  await enforceRateLimit(request, request.method === 'GET' ? 120 : 30)
  if (request.method === 'GET' && url.pathname === '/health') return json(request, env, { status: 'ok', service: 'live-sports-tv-api', time: new Date().toISOString() })
  if (request.method === 'GET' && url.pathname === '/api/matches') return publicMatches(request, env, ctx)
  if (request.method === 'POST' && url.pathname === '/admin/sync') {
    await requireAdmin(request, env)
    const count = await syncFixtures(env)
    return json(request, env, { message: `Fixture sync completed: ${count} records`, count })
  }
  if (request.method === 'POST' && url.pathname === '/admin/discover') {
    await requireAdmin(request, env)
    const count = await discoverOfficialSources(env, true)
    return json(request, env, { message: `Discovery completed: ${count} candidates`, count })
  }
  if (request.method === 'POST' && url.pathname === '/playback/events') {
    if (Number(request.headers.get('Content-Length') || 0) > 2048) throw new HttpError(413, 'Request body is too large')
    const parsed = playbackEventSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new HttpError(400, 'Invalid playback event')
    await recordPlaybackEvent(env, parsed.data.stream_id, parsed.data.event_type, parsed.data.error_code)
    return json(request, env, { accepted: true }, { status: 202, headers: { 'Cache-Control': 'no-store' } })
  }
  const playbackMatch = url.pathname.match(/^\/playback\/([0-9a-f-]{36})$/i)
  if (request.method === 'POST' && playbackMatch) {
    const territory = typeof request.cf?.country === 'string' ? request.cf.country : 'BD'
    await recordPlaybackEvent(env, playbackMatch[1], 'requested')
    try {
      const result = await authorizePlayback(env, playbackMatch[1], territory)
      await recordPlaybackEvent(env, playbackMatch[1], 'started')
      return json(request, env, result, { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (error) {
      await recordPlaybackEvent(env, playbackMatch[1], 'error', error instanceof Error ? error.message : 'authorization_failed').catch(() => undefined)
      throw error
    }
  }
  throw new HttpError(404, 'Not found')
}

async function runScheduled(controller: ScheduledController, env: Env): Promise<void> {
  const started = Date.now()
  try {
    if (controller.cron === '7 * * * *') await syncFixtures(env)
    if (controller.cron === '*/5 * * * *') await Promise.all([refreshLiveFixtures(env), discoverOfficialSources(env)])
    console.log(JSON.stringify({ message: 'cron completed', cron: controller.cron, duration_ms: Date.now() - started }))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(JSON.stringify({ message: 'cron failed', cron: controller.cron, error: message, duration_ms: Date.now() - started }))
    if (/rate limit|429/i.test(message)) controller.noRetry()
    throw error
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await handleRequest(request, env, ctx)
    } catch (error) {
      const status = error instanceof HttpError ? error.status : error instanceof z.ZodError ? 502 : 500
      const message = error instanceof HttpError ? error.message : status === 502 ? 'Upstream data validation failed' : 'Internal server error'
      console.error(JSON.stringify({ message: 'request failed', path: new URL(request.url).pathname, status, error: error instanceof Error ? error.message : String(error) }))
      return json(request, env, { error: message }, { status })
    }
  },
  scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): void {
    ctx.waitUntil(runScheduled(controller, env))
  },
} satisfies ExportedHandler<Env>
