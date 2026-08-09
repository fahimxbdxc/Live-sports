import { z } from 'zod'
import { dbRequest } from './db'

const userSchema = z.object({ id: z.string().uuid() })
const roleSchema = z.array(z.object({ role: z.enum(['user', 'admin']) })).max(1)

export function corsHeaders(request: Request, env: Env): Headers {
  const origin = request.headers.get('Origin') || ''
  const allowed = env.ALLOWED_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean)
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  })
  if (allowed.includes(origin)) headers.set('Access-Control-Allow-Origin', origin)
  return headers
}

export function originAllowed(request: Request, env: Env): boolean {
  const origin = request.headers.get('Origin')
  if (!origin) return true
  return env.ALLOWED_ORIGINS.split(',').map((value) => value.trim()).includes(origin)
}

export async function requireAdmin(request: Request, env: Env): Promise<string> {
  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) throw new HttpError(401, 'Authentication required')
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_SECRET_KEY, Authorization: authorization },
    signal: AbortSignal.timeout(8_000),
  })
  if (!response.ok) throw new HttpError(401, 'Invalid or expired session')
  const user = userSchema.parse(await response.json())
  const roles = await dbRequest(env, `profiles?id=eq.${encodeURIComponent(user.id)}&select=role&limit=1`, roleSchema)
  if (roles[0]?.role !== 'admin') throw new HttpError(403, 'Admin role required')
  return user.id
}

async function rateKey(request: Request): Promise<Request> {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
  const bytes = new TextEncoder().encode(`${ip}:${new URL(request.url).pathname}`)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  const key = Array.from(new Uint8Array(hash)).slice(0, 12).map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return new Request(`https://rate-limit.internal/${key}`)
}

export async function enforceRateLimit(request: Request, limit = 60): Promise<void> {
  const cache = caches.default
  const key = await rateKey(request)
  const current = await cache.match(key)
  const count = current ? Number(current.headers.get('X-Count') || '0') : 0
  if (count >= limit) throw new HttpError(429, 'Rate limit exceeded')
  await cache.put(key, new Response(null, { headers: { 'X-Count': String(count + 1), 'Cache-Control': 'max-age=60' } }))
}

export class HttpError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}
