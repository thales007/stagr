import { Redis } from '@upstash/redis'
import { NextRequest, NextResponse } from 'next/server'

const ITEMS_KEY = 'stagr:items'

function getRedis() {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

export async function GET() {
  const redis = getRedis()
  if (!redis) {
    return NextResponse.json({ items: [], synced: false })
  }
  try {
    const items = await redis.get(ITEMS_KEY)
    return NextResponse.json({ items: items ?? [], synced: true })
  } catch {
    return NextResponse.json({ items: [], synced: false })
  }
}

export async function POST(req: NextRequest) {
  const redis = getRedis()
  if (!redis) {
    return NextResponse.json({ ok: false, reason: 'Redis not configured' })
  }
  try {
    const { items } = await req.json()
    await redis.set(ITEMS_KEY, items)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, reason: 'Redis write failed' }, { status: 500 })
  }
}
