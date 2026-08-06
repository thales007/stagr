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
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
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

  let cloud: Item[] = []
  try {
    cloud = (await redis.get<Item[]>(ITEMS_KEY)) ?? []
    if (!Array.isArray(cloud)) cloud = []
  } catch {
    // If read fails, start fresh — don't block the write
    cloud = []
  }

  const merged = [...cloud]
  let added = 0
  let recovered = 0

  for (const item of incoming) {
    if (!item.id) continue
    const idx = merged.findIndex(e => e.id === item.id)
    if (idx === -1) {
      merged.push(item)
      added++
    } else if ((item.photos?.length ?? 0) > (merged[idx].photos?.length ?? 0)) {
      merged[idx] = { ...merged[idx], photos: item.photos }
      recovered++
    }
  }

  try {
    await redis.set(ITEMS_KEY, merged)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Redis write failed', reason: msg }, { status: 500 })
  }

  return NextResponse.json({ ok: true, added, recovered })
}
