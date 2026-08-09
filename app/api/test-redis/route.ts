import { NextResponse } from 'next/server'

export async function GET() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  const result: Record<string, unknown> = {
    hasUrl: !!url,
    hasToken: !!token,
    urlPrefix: url ? url.slice(0, 40) + '…' : null,
  }

  if (!url || !token) {
    result.error = 'env vars missing — set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel'
    return NextResponse.json(result)
  }

  // Bypass the SDK — hit Upstash REST directly with a plain fetch
  // GET /get/stagr:ping  →  { result: "pong" } if key exists, { result: null } if not
  try {
    const res = await Promise.race([
      fetch(`${url}/set/stagr:ping/hello`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout 6s')), 6000)),
    ]) as Response
    const body = await res.json()
    result.directWrite = { status: res.status, body }
  } catch (e) {
    result.directWrite = { error: e instanceof Error ? e.message : String(e) }
  }

  // Also test basic internet connectivity from Vercel
  try {
    const res = await Promise.race([
      fetch('https://httpbin.org/get'),
      new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout 6s')), 6000)),
    ]) as Response
    result.internetTest = { status: res.status, ok: res.ok }
  } catch (e) {
    result.internetTest = { error: e instanceof Error ? e.message : String(e) }
  }

  return NextResponse.json(result)
}
