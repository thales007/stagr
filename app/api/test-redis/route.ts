import { NextResponse } from 'next/server'
import { redisGet, redisSet } from '@/lib/redis'

export async function GET() {
  const hasUrl = !!process.env.UPSTASH_REDIS_REST_URL
  const hasToken = !!process.env.UPSTASH_REDIS_REST_TOKEN
  const urlPrefix = process.env.UPSTASH_REDIS_REST_URL?.slice(0, 40) + '…'

  if (!hasUrl || !hasToken) {
    return NextResponse.json({ hasUrl, hasToken, error: 'env vars missing' })
  }

  let writeResult: unknown = null
  let writeError: string | null = null
  try {
    await redisSet('stagr:ping', 'pong')
    writeResult = 'OK'
  } catch (e) { writeError = e instanceof Error ? e.message : String(e) }

  let readResult: unknown = null
  let readError: string | null = null
  try {
    readResult = await redisGet('stagr:ping')
  } catch (e) { readError = e instanceof Error ? e.message : String(e) }

  let itemCount: unknown = 'unknown'
  try {
    const items = await redisGet<unknown[]>('stagr:items')
    itemCount = Array.isArray(items) ? items.length : (items === null ? 0 : typeof items)
  } catch (e) { itemCount = 'error: ' + (e instanceof Error ? e.message : String(e)) }

  return NextResponse.json({
    hasUrl, hasToken, urlPrefix,
    write: writeError ? { error: writeError } : { result: writeResult },
    read: readError ? { error: readError } : { result: readResult },
    itemCount,
  })
}
