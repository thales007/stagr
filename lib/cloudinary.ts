const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ''
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? ''

export async function uploadPhoto(file: File): Promise<{ url: string; publicId: string }> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error('Cloudinary is not configured. Fill in .env.local values.')
  }

  const form = new FormData()
  form.append('file', file)
  form.append('upload_preset', UPLOAD_PRESET)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Cloudinary upload failed: ${text}`)
  }

  const data = await res.json()
  // Insert f_auto,q_auto so Cloudinary converts HEIC/any format to browser-renderable WebP/JPEG
  const url = (data.secure_url as string).replace('/upload/', '/upload/f_auto,q_auto/')
  return { url, publicId: data.public_id as string }
}
