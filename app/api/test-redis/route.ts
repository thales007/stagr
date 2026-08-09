import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

function getRedis() {
  try { return Redis.fromEnv() } catch { return null }
}

export async function GET() {
  const redis = getRedis()
  if (!redis) {
    return NextResponse.json({
      error: 'Redis not configured',
      hint: 'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel env vars',
    })
  }

  const timeout = (ms: number) =>
    new Promise<never>((_, r) => setTimeout(() => r(new Error(`timeout after ${ms}ms`)), ms))

  let writeResult: unknown = null
  let writeError: string | null = null
  try {
    writeResult = await Promise.race([redis.set('stagr:ping', 'pong'), timeout(5000)])
  } catch (e) { writeError = e instanceof Error ? e.message : String(e) }

  let readResult: unknown = null
  let readError: string | null = null
  try {
    readResult = await Promise.race([redis.get('stagr:ping'), timeout(5000)])
  } catch (e) { readError = e instanceof Error ? e.message : String(e) }

  let itemCount: number | string = 'unknown'
  try {
    const items = await Promise.race([redis.get<unknown[]>('stagr:items'), timeout(5000)])
    itemCount = Array.isArray(items) ? items.length : (items === null ? 0 : typeof items)
  } catch (e) { itemCount = 'error: ' + (e instanceof Error ? e.message : String(e)) }

  return NextResponse.json({
    write: writeError ? { error: writeError } : { result: writeResult },
    read: readError ? { error: readError } : { result: readResult },
    itemCount,
  })
}
