import { v2 as cloudinary } from 'cloudinary'
import { NextRequest, NextResponse } from 'next/server'
import { redisGet, redisSet } from '@/lib/redis'

const TRASH_KEY = 'stagr:trash'
const HOURS_48 = 48 * 60 * 60 * 1000

interface Photo { url: string; publicId: string }
interface TrashItem { id: string; sku: string; deletedAt: string; photos: Photo[] }

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const trash = (await redisGet<TrashItem[]>(TRASH_KEY)) ?? []
    const now = Date.now()
    const expired = trash.filter(i => now - new Date(i.deletedAt).getTime() >= HOURS_48)
    const remaining = trash.filter(i => now - new Date(i.deletedAt).getTime() < HOURS_48)
    if (expired.length === 0) {
      return NextResponse.json({ ok: true, purged: 0, photos: 0 })
    }
    cloudinary.config({
      cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '',
      api_key: process.env.CLOUDINARY_API_KEY ?? '',
      api_secret: process.env.CLOUDINARY_API_SECRET ?? '',
    })
    const publicIds = expired.flatMap(i => (i.photos ?? []).map(p => p.publicId))
    await Promise.all(publicIds.map(id => cloudinary.uploader.destroy(id)))
    await redisSet(TRASH_KEY, remaining)
    return NextResponse.json({ ok: true, purged: expired.length, photos: publicIds.length })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
