import { NextRequest, NextResponse } from 'next/server'
import { redisSet } from '@/lib/redis'

const ITEMS_KEY = 'stagr:items'

interface Photo { url: string; publicId: string }
interface Item { id: string; sku: string; dateAdded: string; photos: Photo[] }

export async function GET() {
  return NextResponse.json({ ok: true, ready: true })
}

export async function POST(req: NextRequest) {
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
  try {
    await redisSet(ITEMS_KEY, incoming)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Redis write failed', reason: msg }, { status: 500 })
  }
  return NextResponse.json({ ok: true, added: incoming.length, recovered: 0 })
}
