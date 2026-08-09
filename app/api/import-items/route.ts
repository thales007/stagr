import { NextRequest, NextResponse } from 'next/server'
import { redisGet, redisSet } from '@/lib/redis'

const ITEMS_KEY = 'stagr:items'

interface Photo { url: string; publicId: string }
interface Item { id: string; sku: string; dateAdded: string; photos: Photo[] }

export async function POST(req: NextRequest) {
  let incoming: Item[]
  try {
    const body = await req.json()
    incoming = Array.isArray(body.items) ? body.items : []
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  try {
    const cloud: Item[] = (await redisGet<Item[]>(ITEMS_KEY)) ?? []
    const merged = [...cloud]
    let added = 0, recovered = 0
    for (const item of incoming) {
      if (!item.id) continue
      const idx = merged.findIndex(e => e.id === item.id)
      if (idx === -1) { merged.push(item); added++ }
      else if ((item.photos?.length ?? 0) > (merged[idx].photos?.length ?? 0)) {
        merged[idx] = { ...merged[idx], photos: item.photos }; recovered++
      }
    }
    if (added > 0 || recovered > 0) await redisSet(ITEMS_KEY, merged)
    return NextResponse.json({ ok: true, added, recovered })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
