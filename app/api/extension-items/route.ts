import { NextResponse } from 'next/server'
import { redisGet } from '@/lib/redis'

const ITEMS_KEY = 'stagr:items'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

export async function GET() {
  try {
    const items = await redisGet(ITEMS_KEY)
    return NextResponse.json({ items: items ?? [] }, { headers: CORS })
  } catch {
    return NextResponse.json({ items: [] }, { headers: CORS })
  }
}
