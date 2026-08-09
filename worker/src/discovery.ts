import { z } from 'zod'
import { calculateDiscoveryScore } from '../../src/lib/discovery-score'
import { dbRequest, runLogged } from './db'

const matchSchema = z.object({
  id: z.string().uuid(),
  starts_at: z.string().datetime({ offset: true }),
  ends_at: z.string().datetime({ offset: true }).nullable(),
  competition: z.object({ name: z.string() }),
  home_team: z.object({ name: z.string() }),
  away_team: z.object({ name: z.string() }),
})

const sourceSchema = z.object({
  id: z.string().uuid(),
  provider_name: z.string(),
  provider_domain: z.string(),
  source_type: z.enum(['youtube_embed', 'official_embed', 'licensed_hls', 'licensed_dash', 'external_official_link']),
  official_channel_id: z.string().nullable(),
  territory: z.array(z.string()),
  embed_allowed: z.boolean(),
  permission_status: z.enum(['pending', 'approved', 'rejected', 'expired']),
  rights_expiry: z.string().datetime({ offset: true }).nullable(),
  source_page_url: z.string().url(),
  active: z.boolean(),
})

const settingsSchema = z.array(z.object({ discovery_threshold: z.number().int().min(50).max(100), discovery_interval_minutes: z.number().int().min(5).max(1440) })).length(1)
const lastDiscoverySchema = z.array(z.object({ finished_at: z.string().datetime({ offset: true }) })).max(1)
const searchSchema = z.object({
  items: z.array(z.object({ id: z.object({ videoId: z.string() }), snippet: z.object({ title: z.string(), channelId: z.string() }) })).default([]),
})
const videosSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    snippet: z.object({ title: z.string(), channelId: z.string() }),
    status: z.object({ embeddable: z.boolean() }),
    liveStreamingDetails: z.object({ scheduledStartTime: z.string().datetime({ offset: true }).optional(), actualStartTime: z.string().datetime({ offset: true }).optional() }).optional(),
  })).default([]),
})

type DiscoveryMatch = z.infer<typeof matchSchema>
type ApprovedSource = z.infer<typeof sourceSchema>

function sourceCurrentlyAuthorized(source: ApprovedSource): boolean {
  return source.active && source.permission_status === 'approved' && source.embed_allowed &&
    (source.territory.includes('BD') || source.territory.includes('GLOBAL')) &&
    (!source.rights_expiry || new Date(source.rights_expiry).getTime() > Date.now())
}

async function discoverYouTube(env: Env, match: DiscoveryMatch, source: ApprovedSource, threshold: number): Promise<number> {
  if (!env.YOUTUBE_API_KEY || !source.official_channel_id || !sourceCurrentlyAuthorized(source)) return 0
  const query = `${match.home_team.name} ${match.away_team.name} ${match.competition.name}`
  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
  searchUrl.search = new URLSearchParams({
    part: 'snippet', channelId: source.official_channel_id, eventType: 'live', type: 'video',
    videoEmbeddable: 'true', videoSyndicated: 'true', regionCode: 'BD', maxResults: '5', q: query,
    key: env.YOUTUBE_API_KEY,
  }).toString()
  const searchResponse = await fetch(searchUrl, { signal: AbortSignal.timeout(10_000) })
  if (!searchResponse.ok) throw new Error(`YouTube search failed: ${searchResponse.status}`)
  const search = searchSchema.parse(await searchResponse.json())
  if (!search.items.length) return 0

  const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
  videosUrl.search = new URLSearchParams({ part: 'snippet,status,liveStreamingDetails', id: search.items.map((item) => item.id.videoId).join(','), key: env.YOUTUBE_API_KEY }).toString()
  const videosResponse = await fetch(videosUrl, { signal: AbortSignal.timeout(10_000) })
  if (!videosResponse.ok) throw new Error(`YouTube validation failed: ${videosResponse.status}`)
  const videos = videosSchema.parse(await videosResponse.json())
  let count = 0
  for (const video of videos.items) {
    if (!video.status.embeddable || video.snippet.channelId !== source.official_channel_id) continue
    const scheduledStart = video.liveStreamingDetails?.scheduledStartTime || video.liveStreamingDetails?.actualStartTime
    const confidence = calculateDiscoveryScore(
      { startsAt: match.starts_at, competition: match.competition.name, homeTeam: match.home_team.name, awayTeam: match.away_team.name },
      { title: video.snippet.title, approvedChannel: source.official_channel_id === video.snippet.channelId, scheduledStart },
    )
    const valid = confidence >= 45
    const autoApprove = valid && confidence >= threshold
    await dbRequest(env, 'source_candidates?on_conflict=match_id,approved_source_id,provider_asset_id', z.undefined(), {
      method: 'POST',
      body: {
        match_id: match.id,
        approved_source_id: source.id,
        provider_asset_id: video.id,
        embed_url: `https://www.youtube-nocookie.com/embed/${video.id}`,
        source_page_url: `https://www.youtube.com/watch?v=${video.id}`,
        confidence_score: confidence,
        validation_status: valid ? 'valid' : 'invalid',
        validation_reason: valid ? 'Approved channel, embeddable and territory-valid' : 'Title did not match both teams and competition',
        review_status: autoApprove ? 'approved' : 'pending',
        discovered_at: new Date().toISOString(),
        reviewed_at: autoApprove ? new Date().toISOString() : null,
      },
      prefer: 'resolution=merge-duplicates,return=minimal',
    })
    count += 1
  }
  return count
}

export async function discoverOfficialSources(env: Env, force = false): Promise<number> {
  const settings = await dbRequest(env, 'site_settings?id=eq.1&select=discovery_threshold,discovery_interval_minutes', settingsSchema)
  if (!force) {
    const previous = await dbRequest(env, 'sync_logs?job_type=eq.source_discovery&status=in.(success,skipped)&finished_at=not.is.null&order=finished_at.desc&limit=1&select=finished_at', lastDiscoverySchema)
    if (previous[0] && Date.now() - new Date(previous[0].finished_at).getTime() < settings[0].discovery_interval_minutes * 60_000) return 0
  }
  return runLogged(env, 'source_discovery', 'approved_sources', async () => {
    const now = new Date()
    const windowStart = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()
    const windowEnd = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString()
    const [matches, sources] = await Promise.all([
      dbRequest(env, `matches?status=in.(scheduled,live,halftime)&starts_at=gte.${encodeURIComponent(windowStart)}&starts_at=lte.${encodeURIComponent(windowEnd)}&select=id,starts_at,ends_at,competition:competitions(name),home_team:teams!matches_home_team_id_fkey(name),away_team:teams!matches_away_team_id_fkey(name)`, z.array(matchSchema)),
      dbRequest(env, 'approved_sources?active=eq.true&permission_status=eq.approved&select=id,provider_name,provider_domain,source_type,official_channel_id,territory,embed_allowed,permission_status,rights_expiry,source_page_url,active', z.array(sourceSchema)),
    ])
    let count = 0
    for (const match of matches) {
      for (const source of sources) {
        if (source.source_type === 'youtube_embed') count += await discoverYouTube(env, match, source, settings[0].discovery_threshold)
      }
    }
    return { value: count, count }
  })
}
