import { NextRequest, NextResponse } from 'next/server'
import { redisGet, redisSet } from '@/lib/redis'

const ITEMS_KEY = 'stagr:items'
const TRASH_KEY = 'stagr:trash'

export async function GET() {
  try {
    const [items, trash] = await Promise.all([
      redisGet<unknown[]>(ITEMS_KEY),
      redisGet<{ id: string }[]>(TRASH_KEY),
    ])
    const trashIds = (trash ?? []).map(i => i.id)
    return NextResponse.json({ items: items ?? [], trashIds, synced: true })
  } catch {
    return NextResponse.json({ items: [], trashIds: [], synced: false })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { items } = await req.json()
    await redisSet(ITEMS_KEY, items)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, reason: msg }, { status: 500 })
  }
}
