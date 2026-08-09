import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

function getRedis() {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

export async function GET() {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN

  if (!url || !token) {
    return NextResponse.json({ error: 'env vars missing', url: !!url, token: !!token })
  }

  const redis = getRedis()!

  // Test write
  let writeResult: unknown = null
  let writeError: string | null = null
  try {
    writeResult = await Promise.race([
      redis.set('stagr:ping', 'pong'),
      new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 5000)),
    ])
  } catch (e) {
    writeError = e instanceof Error ? e.message : String(e)
  }

  // Test read
  let readResult: unknown = null
  let readError: string | null = null
  try {
    readResult = await Promise.race([
      redis.get('stagr:ping'),
      new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 5000)),
    ])
  } catch (e) {
    readError = e instanceof Error ? e.message : String(e)
  }

  // Check what's in stagr:items
  let itemCount: number | string = 'unknown'
  try {
    const items = await Promise.race([
      redis.get<unknown[]>('stagr:items'),
      new Promise<null>((_, r) => setTimeout(() => r(null), 5000)),
    ])
    itemCount = Array.isArray(items) ? items.length : (items === null ? 0 : typeof items)
  } catch (e) {
    itemCount = 'error: ' + (e instanceof Error ? e.message : String(e))
  }

  return NextResponse.json({
    write: writeError ? { error: writeError } : { result: writeResult },
    read: readError ? { error: readError } : { result: readResult },
    itemCount,
    urlPrefix: url.slice(0, 30) + '…',
  })
}
