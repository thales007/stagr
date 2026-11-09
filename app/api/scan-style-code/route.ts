import { NextResponse } from 'next/server'
import { redisGet } from '@/lib/redis'

const CONFIG_KEY = 'stagr:config'

export async function POST(req: Request) {
  try {
    const { photoUrl } = await req.json()
    if (!photoUrl) return NextResponse.json({ error: 'photoUrl required' }, { status: 400 })

    const config = await redisGet<Record<string, string>>(CONFIG_KEY)
    const apiKey = config?.anthropicKey
    if (!apiKey) return NextResponse.json({ error: 'No API key configured' }, { status: 400 })

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 64,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'url', url: photoUrl } },
            { type: 'text', text: 'This is a photo of a shoe or clothing item. Find the style code or model number on any visible tag or label — examples: "DH2987-100", "554724-074", "FZ5922-010". Return ONLY the style code, nothing else. If you cannot find one, return "NOT FOUND".' },
          ],
        }],
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json({ error: err.error?.message || `API error ${res.status}` }, { status: 502 })
    }

    const data = await res.json()
    const code = data.content?.[0]?.text?.trim() || 'NOT FOUND'
    return NextResponse.json({ styleCode: code === 'NOT FOUND' ? null : code })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
