import { Redis } from '@upstash/redis'
import { v2 as cloudinary } from 'cloudinary'
import { NextResponse } from 'next/server'

const TRASH_KEY = 'stagr:trash'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

interface Photo {
  url: string
  publicId: string
}

interface TrashItem {
  id: string
  sku: string
  dateAdded: string
  deletedAt: string
  photos: Photo[]
}

function getRedis() {
  try { return Redis.fromEnv() } catch { return null }
}

function getCloudinary() {
  cloudinary.config({
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '',
    api_key: process.env.CLOUDINARY_API_KEY ?? '',
    api_secret: process.env.CLOUDINARY_API_SECRET ?? '',
  })
  return cloudinary
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

export async function GET() {
  const redis = getRedis()
  if (!redis) {
    return NextResponse.json({ count: 0, totalPhotos: 0 }, { headers: CORS })
  }
  try {
    const trash = (await redis.get<TrashItem[]>(TRASH_KEY)) ?? []
    const count = trash.length
    const totalPhotos = trash.reduce((sum, item) => sum + (item.photos?.length ?? 0), 0)
    return NextResponse.json({ count, totalPhotos }, { headers: CORS })
  } catch {
    return NextResponse.json({ count: 0, totalPhotos: 0 }, { headers: CORS })
  }
}

export async function DELETE() {
  const redis = getRedis()
  if (!redis) {
    return NextResponse.json({ error: 'Redis not configured' }, { status: 503, headers: CORS })
  }

  try {
    const trash = (await redis.get<TrashItem[]>(TRASH_KEY)) ?? []
    if (trash.length === 0) {
      return NextResponse.json({ ok: true, deleted: 0, photos: 0 }, { headers: CORS })
    }

    const cld = getCloudinary()
    const publicIds = trash.flatMap(item => (item.photos ?? []).map(p => p.publicId))
    const totalPhotos = publicIds.length

    await Promise.all(publicIds.map(id => cld.uploader.destroy(id)))
    await redis.set(TRASH_KEY, [])

    console.log(`[trash] Emptied ${trash.length} items, ${totalPhotos} photos at ${new Date().toISOString()}`)
    return NextResponse.json({ ok: true, deleted: trash.length, photos: totalPhotos }, { headers: CORS })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500, headers: CORS })
  }
}
