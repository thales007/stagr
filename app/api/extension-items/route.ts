import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const ITEMS_KEY = 'stagr:items'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function getRedis() {
  try { return Redis.fromEnv() } catch { return null }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

export async function GET() {
  const redis = getRedis()
  if (!redis) {
    return NextResponse.json({ items: [] }, { headers: CORS })
  }
  try {
    const items = await redis.get(ITEMS_KEY)
    return NextResponse.json({ items: items ?? [] }, { headers: CORS })
  } catch {
    return NextResponse.json({ items: [] }, { headers: CORS })
  }
}
