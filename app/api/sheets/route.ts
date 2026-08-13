import { NextResponse } from 'next/server'
import { redisGet } from '@/lib/redis'

export async function POST(req: Request) {
  try {
    const config = (await redisGet<Record<string, string>>('stagr:config')) ?? {}
    const sheetsUrl = config.sheetsUrl
    if (!sheetsUrl) {
      return NextResponse.json(
        { error: 'Sheets URL not configured. Save it in the browser extension settings first.' },
        { status: 400 }
      )
    }
    const body = await req.json()
    const res = await fetch(sheetsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
