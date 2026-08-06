import { Redis } from '@upstash/redis'
import { NextRequest, NextResponse } from 'next/server'

const ITEMS_KEY = 'stagr:items'
const TRASH_KEY = 'stagr:trash'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

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

interface TrashItem extends Item {
  deletedAt: string
}

function getRedis() {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

export async function POST(req: NextRequest) {
  const redis = getRedis()
  if (!redis) {
    return NextResponse.json({ error: 'Redis not configured' }, { status: 503, headers: CORS })
  }

  let itemId: string
  try {
    const body = await req.json()
    itemId = body.itemId
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: CORS })
  }

  if (!itemId) {
    return NextResponse.json({ error: 'itemId is required' }, { status: 400, headers: CORS })
  }

  try {
    const [rawItems, rawTrash] = await Promise.all([
      redis.get<Item[]>(ITEMS_KEY),
      redis.get<TrashItem[]>(TRASH_KEY),
    ])

    const items: Item[] = rawItems ?? []
    const trash: TrashItem[] = rawTrash ?? []

    const item = items.find(i => i.id === itemId)
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404, headers: CORS })
    }

    const remaining = items.filter(i => i.id !== itemId)
    const trashItem: TrashItem = { ...item, deletedAt: new Date().toISOString() }

    await Promise.all([
      redis.set(ITEMS_KEY, remaining),
      redis.set(TRASH_KEY, [...trash, trashItem]),
    ])

    return NextResponse.json({ ok: true }, { headers: CORS })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500, headers: CORS })
  }
}
