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

  const cloud: Item[] = (await redis.get<Item[]>(ITEMS_KEY)) ?? []
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
      // Item already in cloud but missing photos — recover them
      merged[idx] = { ...merged[idx], photos: item.photos }
      recovered++
    }
  }

  if (added > 0 || recovered > 0) {
    await redis.set(ITEMS_KEY, merged)
  }

  return NextResponse.json({ ok: true, added, recovered })
}
