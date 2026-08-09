import { v2 as cloudinary } from 'cloudinary'
import { NextResponse } from 'next/server'
import { redisGet, redisSet } from '@/lib/redis'

const TRASH_KEY = 'stagr:trash'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

interface Photo { url: string; publicId: string }
interface TrashItem { id: string; sku: string; dateAdded: string; deletedAt: string; photos: Photo[] }

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
  try {
    const trash = (await redisGet<TrashItem[]>(TRASH_KEY)) ?? []
    return NextResponse.json({
      count: trash.length,
      totalPhotos: trash.reduce((n, i) => n + (i.photos?.length ?? 0), 0),
    }, { headers: CORS })
  } catch {
    return NextResponse.json({ count: 0, totalPhotos: 0 }, { headers: CORS })
  }
}

export async function DELETE() {
  try {
    const trash = (await redisGet<TrashItem[]>(TRASH_KEY)) ?? []
    if (trash.length === 0) {
      return NextResponse.json({ ok: true, deleted: 0, photos: 0 }, { headers: CORS })
    }
    const cld = getCloudinary()
    const publicIds = trash.flatMap(i => (i.photos ?? []).map(p => p.publicId))
    await Promise.all(publicIds.map(id => cld.uploader.destroy(id)))
    await redisSet(TRASH_KEY, [])
    return NextResponse.json({ ok: true, deleted: trash.length, photos: publicIds.length }, { headers: CORS })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500, headers: CORS })
  }
}
