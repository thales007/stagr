import { NextRequest, NextResponse } from 'next/server'
import { redisGet, redisSet } from '@/lib/redis'

const ITEMS_KEY = 'stagr:items'
const TRASH_KEY = 'stagr:trash'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

interface Photo { url: string; publicId: string }
interface Item { id: string; sku: string; dateAdded: string; photos: Photo[] }
interface TrashItem extends Item { deletedAt: string }

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

export async function POST(req: NextRequest) {
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
    const [items, trash]: [Item[], TrashItem[]] = await Promise.all([
      redisGet<Item[]>(ITEMS_KEY).then(v => v ?? []),
      redisGet<TrashItem[]>(TRASH_KEY).then(v => v ?? []),
    ])
    const item = items.find(i => i.id === itemId)
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404, headers: CORS })
    }
    await Promise.all([
      redisSet(ITEMS_KEY, items.filter(i => i.id !== itemId)),
      redisSet(TRASH_KEY, [...trash, { ...item, deletedAt: new Date().toISOString() }]),
    ])
    return NextResponse.json({ ok: true }, { headers: CORS })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500, headers: CORS })
  }
}
