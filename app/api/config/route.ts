import { NextResponse } from 'next/server'
import { redisGet, redisSet } from '@/lib/redis'

const CONFIG_KEY = 'stagr:config'

export async function GET() {
  try {
    const config = await redisGet<Record<string, unknown>>(CONFIG_KEY)
    return NextResponse.json(config ?? {})
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const updates = await req.json()
    const current = (await redisGet<Record<string, unknown>>(CONFIG_KEY)) ?? {}
    await redisSet(CONFIG_KEY, { ...current, ...updates })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
