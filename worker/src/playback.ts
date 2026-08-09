import { z } from 'zod'
import { dbRequest } from './db'
import { HttpError } from './security'

const streamSchema = z.array(z.object({
  id: z.string().uuid(),
  provider_asset_id: z.string(),
  source_type: z.enum(['youtube_embed', 'official_embed', 'licensed_hls', 'licensed_dash', 'external_official_link']),
  territory: z.array(z.string()),
  status: z.enum(['active', 'disabled', 'expired']),
  expires_at: z.string().datetime({ offset: true }).nullable(),
  provider: z.object({ provider_domain: z.string(), active: z.boolean(), permission_status: z.enum(['pending', 'approved', 'rejected', 'expired']) }),
})).max(1)

const providerResponseSchema = z.object({
  playback_url: z.string().url(),
  expires_at: z.string().datetime({ offset: true }),
  drm_license_url: z.string().url().optional(),
  drm_key_system: z.enum(['com.widevine.alpha', 'com.microsoft.playready', 'com.apple.fps']).optional(),
})

const playbackLookupSchema = z.array(z.object({ id: z.string().uuid(), match_id: z.string().uuid() })).max(1)
export type PlaybackEventType = 'requested' | 'started' | 'error' | 'fallback' | 'external_open'

export async function recordPlaybackEvent(env: Env, streamId: string, eventType: PlaybackEventType, errorCode?: string): Promise<void> {
  const streams = await dbRequest(env, `match_streams?id=eq.${encodeURIComponent(streamId)}&select=id,match_id&limit=1`, playbackLookupSchema)
  if (!streams[0]) throw new HttpError(404, 'Stream not found')
  await dbRequest(env, 'playback_logs', z.undefined(), {
    method: 'POST',
    body: {
      match_id: streams[0].match_id,
      match_stream_id: streams[0].id,
      event_type: eventType,
      error_code: errorCode?.slice(0, 120) ?? null,
      metadata: {},
    },
    prefer: 'return=minimal',
  })
}

export async function authorizePlayback(env: Env, streamId: string, territory: string): Promise<z.infer<typeof providerResponseSchema>> {
  const rows = await dbRequest(env, `match_streams?id=eq.${encodeURIComponent(streamId)}&select=id,provider_asset_id,source_type,territory,status,expires_at,provider:approved_sources(provider_domain,active,permission_status)&limit=1`, streamSchema)
  const stream = rows[0]
  if (!stream || stream.status !== 'active') throw new HttpError(404, 'Active stream not found')
  if (!['licensed_hls', 'licensed_dash'].includes(stream.source_type)) throw new HttpError(400, 'Playback authorization is not required for this source')
  if (!stream.provider.active || stream.provider.permission_status !== 'approved') throw new HttpError(403, 'Provider authorization is inactive')
  if (!stream.territory.includes(territory) && !stream.territory.includes('GLOBAL')) throw new HttpError(451, 'Stream is unavailable in this territory')
  if (stream.expires_at && new Date(stream.expires_at).getTime() <= Date.now()) throw new HttpError(410, 'Stream rights have expired')
  if (!env.PLAYBACK_AUTH_ENDPOINT || !env.PLAYBACK_AUTH_TOKEN) throw new HttpError(503, 'Licensed provider authorization is not configured')

  const response = await fetch(env.PLAYBACK_AUTH_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.PLAYBACK_AUTH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ asset_id: stream.provider_asset_id, territory, ttl_seconds: 600 }),
    signal: AbortSignal.timeout(8_000),
  })
  if (!response.ok) throw new HttpError(502, `Provider authorization failed (${response.status})`)
  const result = providerResponseSchema.parse(await response.json())
  const host = new URL(result.playback_url).hostname.toLowerCase()
  if (host !== stream.provider.provider_domain && !host.endsWith(`.${stream.provider.provider_domain}`)) throw new HttpError(502, 'Provider returned a URL outside its approved domain')
  if (result.drm_license_url) {
    const licenseHost = new URL(result.drm_license_url).hostname.toLowerCase()
    if (licenseHost !== stream.provider.provider_domain && !licenseHost.endsWith(`.${stream.provider.provider_domain}`)) throw new HttpError(502, 'Provider returned a DRM license URL outside its approved domain')
    if (!result.drm_key_system) throw new HttpError(502, 'Provider omitted the DRM key system')
  }
  if (new Date(result.expires_at).getTime() > Date.now() + 15 * 60 * 1000) throw new HttpError(502, 'Provider authorization exceeded the maximum lifetime')
  return result
}
