'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { use } from 'react'
import { useItems, Photo } from '@/hooks/useItems'

async function downloadPhoto(photo: Photo, filename: string) {
  try {
    const res = await fetch(photo.url)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    window.open(photo.url, '_blank')
  }
}

export default function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { items, deleteItem } = useItems()
  const [downloading, setDownloading] = useState(false)

  const item = items.find(i => i.id === id)

  if (!item) {
    return (
      <main className="px-4 pt-6">
        <button onClick={() => router.back()} className="text-gray-400 mb-6 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
        <p className="text-gray-500">Item not found.</p>
      </main>
    )
  }

  const formattedDate = new Date(item.dateAdded).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  const sanitisedSku = (item.sku.trim() || item.id)
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/-+/g, '-')
    .trim()

  async function handleDownloadAll() {
    if (!item) return
    setDownloading(true)
    for (let i = 0; i < item.photos.length; i++) {
      await downloadPhoto(item.photos[i], `${sanitisedSku}_${i + 1}.jpg`)
      if (i < item.photos.length - 1) {
        await new Promise(r => setTimeout(r, 600))
      }
    }
    setDownloading(false)
  }

  function handleDelete() {
    if (!window.confirm(`Delete "${item!.sku || item!.id}" and all its photos? This cannot be undone.`)) return
    deleteItem(item!.id)
    router.push('/')
  }

  return (
    <main className="px-4 pt-6 pb-8">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="text-gray-400 mb-5 flex items-center gap-2 min-h-[44px]"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back
      </button>

      {/* Item info */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-mono">{item.sku || 'No SKU'}</h1>
        <p className="text-xs text-gray-500 mt-1">Added {formattedDate}</p>
      </div>

      {/* Photos */}
      {item.photos.length > 0 ? (
        <div className="mb-6">
          {/* Download All button */}
          <button
            onClick={handleDownloadAll}
            disabled={downloading}
            className="w-full h-[48px] bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg flex items-center justify-center gap-2 text-amber-500 text-sm font-medium mb-3 active:opacity-70 disabled:opacity-50 transition-opacity"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {downloading
              ? 'Downloading...'
              : `Download All ${item.photos.length} Photo${item.photos.length !== 1 ? 's' : ''}`}
          </button>

          {/* Photo grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {item.photos.map((photo, i) => (
              <div key={photo.publicId} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={item.sku}
                  className="w-full aspect-square object-cover rounded-lg"
                />
                <button
                  onClick={() => downloadPhoto(photo, `${sanitisedSku}_${i + 1}.jpg`)}
                  className="absolute inset-0 flex items-end justify-center pb-2 opacity-0 group-hover:opacity-100 transition-opacity md:flex hidden"
                >
                  <span className="bg-black/70 text-white text-xs px-2 py-1 rounded">Download</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-6 py-10 text-center border border-dashed border-[#2a2a2a] rounded-lg">
          <p className="text-sm text-gray-600">No photos on this item.</p>
        </div>
      )}

      {/* Delete */}
      <button
        onClick={handleDelete}
        className="w-full h-[52px] bg-[#1a1a1a] border border-red-500/30 text-red-400 font-semibold text-sm rounded-lg active:opacity-80 transition-opacity"
      >
        Delete Item
      </button>
      <p className="text-xs text-gray-600 text-center mt-2">
        Permanently removes this item and all its photos.
      </p>
    </main>
  )
}
