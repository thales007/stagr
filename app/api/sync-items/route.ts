import { Redis } from '@upstash/redis'
import { NextRequest, NextResponse } from 'next/server'

const ITEMS_KEY = 'stagr:items'

interface Photo {
  url: string
  publicId: string
}

interface Item {
  id: string
  sku: string
  dateAdded: string
  photos: Photo[]
}

function getRedis() {
  try { return Redis.fromEnv() } catch { return null }
}

function timedSet(redis: Redis, key: string, value: unknown, ms: number) {
  return Promise.race([
    redis.set(key, value),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Redis timed out after ${ms}ms`)), ms)
    ),
  ])
}

export async function GET() {
  return NextResponse.json({ ok: true, ready: true })
}

export async function POST(req: NextRequest) {
  const redis = getRedis()
  if (!redis) {
    return NextResponse.json({ error: 'Redis not configured' }, { status: 503 })
  }

  let incoming: Item[]
  try {
    const body = await req.json()
    incoming = Array.isArray(body.items) ? body.items : []
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (incoming.length === 0) {
    return NextResponse.json({ ok: true, added: 0, recovered: 0 })
  }

  // Skip reading existing cloud state — write incoming directly.
  // Recovery scenario: local has the photos, cloud is empty or behind.
  // The useItems hook will reconcile on next app load.
  const payload = JSON.stringify(incoming)
  if (payload.length > 900_000) {
    return NextResponse.json(
      { error: 'Payload too large', reason: `${Math.round(payload.length / 1024)} KB` },
      { status: 413 }
    )
  }

  try {
    await timedSet(redis, ITEMS_KEY, incoming, 6000)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Redis write failed', reason: msg }, { status: 500 })
  }

  return NextResponse.json({ ok: true, added: incoming.length, recovered: 0 })
}
