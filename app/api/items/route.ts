import { NextRequest, NextResponse } from 'next/server'
import { redisGet, redisSet } from '@/lib/redis'

const ITEMS_KEY = 'stagr:items'

export async function GET() {
  try {
    const items = await redisGet(ITEMS_KEY)
    return NextResponse.json({ items: items ?? [], synced: true })
  } catch {
    return NextResponse.json({ items: [], synced: false })
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
