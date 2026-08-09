import { Redis } from '@upstash/redis'
import { v2 as cloudinary } from 'cloudinary'
import { NextRequest, NextResponse } from 'next/server'

const TRASH_KEY = 'stagr:trash'
const HOURS_48 = 48 * 60 * 60 * 1000

interface Photo {
  url: string
  publicId: string
}

interface TrashItem {
  id: string
  sku: string
  deletedAt: string
  photos: Photo[]
}

function getRedis() {
  try { return Redis.fromEnv() } catch { return null }
}

export async function GET(req: NextRequest) {
  // Verify Vercel cron secret when present
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const redis = getRedis()
  if (!redis) {
    return NextResponse.json({ ok: false, reason: 'Redis not configured' })
  }

  try {
    const trash = (await redis.get<TrashItem[]>(TRASH_KEY)) ?? []
    const now = Date.now()

    const expired = trash.filter(item => {
      const age = now - new Date(item.deletedAt).getTime()
      return age >= HOURS_48
    })
    const remaining = trash.filter(item => {
      const age = now - new Date(item.deletedAt).getTime()
      return age < HOURS_48
    })

    if (expired.length === 0) {
      console.log(`[cron/purge-trash] Nothing to purge at ${new Date().toISOString()}`)
      return NextResponse.json({ ok: true, purged: 0, photos: 0 })
    }

    cloudinary.config({
      cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '',
      api_key: process.env.CLOUDINARY_API_KEY ?? '',
      api_secret: process.env.CLOUDINARY_API_SECRET ?? '',
    })

    const publicIds = expired.flatMap(item => (item.photos ?? []).map(p => p.publicId))
    await Promise.all(publicIds.map(id => cloudinary.uploader.destroy(id)))
    await redis.set(TRASH_KEY, remaining)

    const skus = expired.map(i => i.sku).join(', ')
    console.log(
      `[cron/purge-trash] Purged ${expired.length} items (${publicIds.length} photos) at ${new Date().toISOString()} — SKUs: ${skus}`
    )

    return NextResponse.json({ ok: true, purged: expired.length, photos: publicIds.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[cron/purge-trash] Error:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
