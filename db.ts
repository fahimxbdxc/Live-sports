import { z } from 'zod'

export interface DbRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  prefer?: string
}

function serviceHeaders(env: Env, prefer?: string): Headers {
  const headers = new Headers({
    apikey: env.SUPABASE_SECRET_KEY,
    Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
    'Content-Type': 'application/json',
  })
  if (prefer) headers.set('Prefer', prefer)
  return headers
}

export async function dbRequest<T>(env: Env, path: string, schema: z.ZodType<T>, options: DbRequestOptions = {}): Promise<T> {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    method: options.method ?? 'GET',
    headers: serviceHeaders(env, options.prefer),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 800)
    throw new Error(`Database request failed (${response.status}): ${detail}`)
  }
  if (response.status === 204 || response.headers.get('content-length') === '0') return schema.parse(undefined)
  return schema.parse(await response.json())
}

export async function startSyncLog(env: Env, jobType: string, provider: string): Promise<string> {
  const schema = z.array(z.object({ id: z.string().uuid() })).length(1)
  const rows = await dbRequest(env, 'sync_logs', schema, {
    method: 'POST',
    body: { job_type: jobType, provider, status: 'running' },
    prefer: 'return=representation',
  })
  return rows[0].id
}

export async function finishSyncLog(env: Env, id: string, status: 'success' | 'failed' | 'skipped', records: number, error?: string): Promise<void> {
  await dbRequest(env, `sync_logs?id=eq.${encodeURIComponent(id)}`, z.undefined(), {
    method: 'PATCH',
    body: {
      status,
      records_processed: records,
      error_message: error?.slice(0, 1200) ?? null,
      finished_at: new Date().toISOString(),
    },
    prefer: 'return=minimal',
  })
}

export async function runLogged<T>(env: Env, jobType: string, provider: string, task: () => Promise<{ value: T; count: number }>): Promise<T> {
  const logId = await startSyncLog(env, jobType, provider)
  try {
    const result = await task()
    await finishSyncLog(env, logId, result.count === 0 ? 'skipped' : 'success', result.count)
    return result.value
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await finishSyncLog(env, logId, 'failed', 0, message)
    throw error
  }
}
