import { v2 as cloudinary } from 'cloudinary'
import { NextRequest, NextResponse } from 'next/server'

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '',
  api_key: process.env.CLOUDINARY_API_KEY ?? '',
  api_secret: process.env.CLOUDINARY_API_SECRET ?? '',
})

export async function POST(req: NextRequest) {
  try {
    const { publicId } = (await req.json()) as { publicId: string }
    if (!publicId) {
      return NextResponse.json({ error: 'publicId is required' }, { status: 400 })
    }
    await cloudinary.uploader.destroy(publicId)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
