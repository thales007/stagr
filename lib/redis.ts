// Upstash Redis via raw REST fetch — bypasses the SDK which fails in this env.
// Uses UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN env vars.

function creds() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error('Redis env vars not set')
  return { url, token }
}

export async function redisGet<T>(key: string): Promise<T | null> {
  const { url, token } = creds()
  const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (data.result === null || data.result === undefined) return null
  if (typeof data.result === 'string') {
    try { return JSON.parse(data.result) as T } catch { return data.result as unknown as T }
  }
  return data.result as T
}

export async function redisSet(key: string, value: unknown): Promise<void> {
  const { url, token } = creds()
  const body = typeof value === 'string' ? value : JSON.stringify(value)
  const res = await fetch(`${url}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Redis SET failed ${res.status}: ${JSON.stringify(err)}`)
  }
}

export async function redisDel(key: string): Promise<void> {
  const { url, token } = creds()
  await fetch(`${url}/del/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
}
