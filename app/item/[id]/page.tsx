'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { use } from 'react'
import { useItems, Photo } from '@/hooks/useItems'
import { uploadPhoto } from '@/lib/cloudinary'

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
  const { items, deleteItem, markListed, updateItem } = useItems()
  const [downloading, setDownloading] = useState(false)
  const [listing, setListing] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [editingSku, setEditingSku] = useState(false)
  const [localSku, setLocalSku] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Crop state
  const [cropPhotoIdx, setCropPhotoIdx] = useState<number | null>(null)
  const cropContainerRef = useRef<HTMLDivElement>(null)
  const cropImgRef = useRef<HTMLImageElement>(null)
  const cropViewfinderRef = useRef<HTMLDivElement>(null)
  const [cropImgScale, setCropImgScale] = useState(1)
  const [cropImgOffset, setCropImgOffset] = useState({ x: 0, y: 0 })
  const cropPointersRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  const cropPinchDistRef = useRef(0)
  const cropPinchMidRef = useRef({ x: 0, y: 0 })

  const foundItem = items.find(i => i.id === id)

  if (!foundItem) {
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

  const item = foundItem
  const formattedDate = new Date(item.dateAdded).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  const sanitisedSku = (item.sku.trim() || item.id)
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/-+/g, '-')
    .trim()

  async function handleDownloadAll() {
    setDownloading(true)
    for (let i = 0; i < item.photos.length; i++) {
      await downloadPhoto(item.photos[i], `${sanitisedSku}_${i + 1}.jpg`)
      if (i < item.photos.length - 1) await new Promise(r => setTimeout(r, 600))
    }
    setDownloading(false)
  }

  async function handleMarkListed() {
    if (!window.confirm(`Mark "${item.sku || item.id}" as listed on eBay? It will move to trash and be deleted after 48 hours.`)) return
    setListing(true)
    await markListed(item.id)
    router.push('/')
  }

  function handleDelete() {
    if (!window.confirm(`Permanently delete "${item.sku || item.id}" and all its photos right now? This cannot be undone.`)) return
    deleteItem(item.id)
    router.push('/')
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setPhotoUploading(true)
    try {
      const newPhotos: Photo[] = []
      for (const file of files) {
        const result = await uploadPhoto(file)
        newPhotos.push(result)
      }
      updateItem(item.id, { photos: [...item.photos, ...newPhotos] })
    } catch { /* best-effort */ }
    finally {
      setPhotoUploading(false)
      if (e.target) e.target.value = ''
    }
  }

  function handleSkuSave() {
    const trimmed = localSku.trim()
    if (trimmed && trimmed !== item.sku) updateItem(item.id, { sku: trimmed })
    setEditingSku(false)
  }


  // ── Crop handlers ────────────────────────────────────────────────────────────
  function openCrop(idx: number) {
    setCropPhotoIdx(idx)
    setCropImgScale(1)
    setCropImgOffset({ x: 0, y: 0 })
    cropPointersRef.current.clear()
  }

  function closeCrop() {
    setCropPhotoIdx(null)
    cropPointersRef.current.clear()
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    cropPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (cropPointersRef.current.size === 2) {
      const pts = [...cropPointersRef.current.values()]
      cropPinchDistRef.current = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)
      cropPinchMidRef.current = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!cropPointersRef.current.has(e.pointerId)) return
    cropPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (cropPointersRef.current.size === 2) {
      const pts = [...cropPointersRef.current.values()]
      const newDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)
      const newMid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
      if (cropPinchDistRef.current > 0) {
        const factor = newDist / cropPinchDistRef.current
        setCropImgScale(s => Math.max(0.5, Math.min(5, s * factor)))
        const dx = newMid.x - cropPinchMidRef.current.x
        const dy = newMid.y - cropPinchMidRef.current.y
        setCropImgOffset(o => ({ x: o.x + dx, y: o.y + dy }))
      }
      cropPinchDistRef.current = newDist
      cropPinchMidRef.current = newMid
    } else if (cropPointersRef.current.size === 1) {
      const prev = [...cropPointersRef.current.values()][0]
      const dx = e.clientX - prev.x
      const dy = e.clientY - prev.y
      setCropImgOffset(o => ({ x: o.x + dx, y: o.y + dy }))
      cropPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    cropPointersRef.current.delete(e.pointerId)
    if (cropPointersRef.current.size < 2) cropPinchDistRef.current = 0
  }

  function computeCropRect() {
    const containerEl = cropContainerRef.current
    const img = cropImgRef.current
    const vf = cropViewfinderRef.current
    if (!containerEl || !img || !vf) return null
    const r = containerEl.getBoundingClientRect()
    const v = vf.getBoundingClientRect()
    const cW = r.width, cH = r.height
    const natW = img.naturalWidth, natH = img.naturalHeight
    if (!natW || !natH) return null
    const base = Math.min(cW / natW, cH / natH)
    const dW = natW * base, dH = natH * base
    const iL = (cW - dW) / 2, iT = (cH - dH) / 2
    const s = cropImgScale, ox = cropImgOffset.x, oy = cropImgOffset.y
    function toImg(sx: number, sy: number) {
      const cx = (sx - r.left - cW / 2 - ox) / s + cW / 2
      const cy = (sy - r.top - cH / 2 - oy) / s + cH / 2
      return { x: (cx - iL) / dW, y: (cy - iT) / dH }
    }
    const tl = toImg(v.left, v.top)
    const br = toImg(v.right, v.bottom)
    return {
      x1: Math.max(0, Math.min(1, tl.x)),
      y1: Math.max(0, Math.min(1, tl.y)),
      x2: Math.max(0, Math.min(1, br.x)),
      y2: Math.max(0, Math.min(1, br.y)),
    }
  }

  function saveCropToItem() {
    if (cropPhotoIdx === null) return
    const rect = computeCropRect()
    if (!rect) return
    updateItem(item.id, {
      tagCrop: { photoName: `photo_${cropPhotoIdx + 1}`, ...rect },
    })
    closeCrop()
  }

  function removeCrop() {
    updateItem(item.id, { tagCrop: null })
    closeCrop()
  }

  return (
    <>
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
          {editingSku ? (
            <div className="flex gap-2 items-center mb-1">
              <input
                type="text"
                value={localSku}
                onChange={e => setLocalSku(e.target.value)}
                onBlur={handleSkuSave}
                onKeyDown={e => { if (e.key === 'Enter') handleSkuSave(); if (e.key === 'Escape') setEditingSku(false) }}
                autoFocus
                className="flex-1 bg-[#1a1a1a] border border-amber-500 text-white text-xl font-bold font-mono px-2 py-1 rounded focus:outline-none"
              />
              <button onClick={handleSkuSave} className="text-amber-400 text-sm font-semibold">Done</button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-2xl font-bold font-mono">{item.sku || 'No SKU'}</h1>
              <button
                onClick={() => { setLocalSku(item.sku); setEditingSku(true) }}
                className="text-gray-600 active:text-gray-400 shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
            </div>
          )}
          <p className="text-xs text-gray-500 mt-0.5">Added {formattedDate}</p>
          <div className="flex gap-1.5 mt-2">
            <button
              onClick={() => updateItem(item.id, { condition: 'used' })}
              className={`h-7 px-2.5 rounded-md border text-[11px] font-semibold transition-colors ${
                (item.condition ?? 'used') === 'used'
                  ? 'border-amber-500 text-amber-500 bg-amber-500/10'
                  : 'border-[#2a2a2a] text-gray-500 bg-[#1a1a1a]'
              }`}
            >Used</button>
            <button
              onClick={() => updateItem(item.id, { condition: 'new' })}
              className={`h-7 px-2.5 rounded-md border text-[11px] font-semibold transition-colors ${
                (item.condition ?? 'used') === 'new'
                  ? 'border-green-500 text-green-500 bg-green-500/10'
                  : 'border-[#2a2a2a] text-gray-500 bg-[#1a1a1a]'
              }`}
            >New</button>
          </div>
          {item.tagCrop && (
            <p className="text-xs text-amber-500 mt-1.5">✂ Tag crop set on {item.tagCrop.photoName}</p>
          )}
          {item.styleCode && (
            <p className="text-xs text-blue-400 font-mono mt-1">{item.styleCode}</p>
          )}
        </div>

        {/* Photos */}
        <div className="mb-6">
          {item.photos.length > 0 ? (
            <>
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
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
                {item.photos.map((photo, i) => {
                  const photoName = `photo_${i + 1}`
                  const hasCrop = item.tagCrop?.photoName === photoName
                  return (
                    <div key={photo.publicId} className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt={item.sku}
                        className="w-full aspect-square object-cover rounded-lg"
                      />
                      {hasCrop && (
                        <div className="absolute top-1.5 left-1.5 bg-amber-400 text-black text-[10px] font-bold px-1.5 py-0.5 rounded pointer-events-none">
                          ✂ tag
                        </div>
                      )}
                      <button
                        onClick={() => openCrop(i)}
                        className="absolute top-1.5 right-1.5 bg-black/70 text-amber-400 text-[10px] font-semibold px-1.5 py-0.5 rounded active:opacity-70"
                      >
                        ✂ crop
                      </button>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="py-8 text-center border border-dashed border-[#2a2a2a] rounded-lg mb-3">
              <p className="text-sm text-gray-600">No photos on this item.</p>
            </div>
          )}

          {/* Add photos from camera or photo library */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={photoUploading}
            className="w-full h-[48px] bg-[#1a1a1a] border border-dashed border-[#2a2a2a] rounded-lg flex items-center justify-center gap-2 text-gray-400 text-sm active:opacity-70 disabled:opacity-50 transition-opacity"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            {photoUploading ? 'Uploading...' : 'Add Photos'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        {/* Mark Listed */}
        <button
          onClick={handleMarkListed}
          disabled={listing}
          className="w-full h-[52px] bg-[#1a1a1a] border border-green-500/40 text-green-400 font-semibold text-sm rounded-lg active:opacity-80 disabled:opacity-50 transition-opacity mb-3"
        >
          {listing ? 'Moving to Trash…' : '✓ Mark Listed on eBay'}
        </button>
        <p className="text-xs text-gray-600 text-center mb-5">
          Moves to trash. Photos auto-delete after 48 hours.
        </p>

        {/* Delete */}
        <button
          onClick={handleDelete}
          className="w-full h-[52px] bg-[#1a1a1a] border border-red-500/30 text-red-400 font-semibold text-sm rounded-lg active:opacity-80 transition-opacity"
        >
          Delete Item Now
        </button>
        <p className="text-xs text-gray-600 text-center mt-2">
          Permanently removes this item and all its photos immediately.
        </p>
      </main>

      {/* Full-screen crop overlay */}
      {cropPhotoIdx !== null && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
            <button onClick={closeCrop} className="text-gray-400 text-sm min-w-[60px]">Cancel</button>
            <span className="text-xs text-gray-500">Pinch &amp; drag to frame the tag</span>
            <button onClick={saveCropToItem} className="text-amber-400 text-sm font-semibold min-w-[60px] text-right">Save</button>
          </div>

          {/* Image + fixed viewfinder */}
          <div
            ref={cropContainerRef}
            className="relative flex-1 overflow-hidden select-none touch-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={cropImgRef}
              src={item.photos[cropPhotoIdx].url}
              alt="crop"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              draggable={false}
              style={{
                transform: `translate(${cropImgOffset.x}px, ${cropImgOffset.y}px) scale(${cropImgScale})`,
                transformOrigin: 'center center',
              }}
            />
            {/* Fixed viewfinder */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div
                ref={cropViewfinderRef}
                className="border-2 border-amber-400 relative"
                style={{ width: '60vmin', height: '60vmin', boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)' }}
              >
                <div className="absolute top-0 left-0 w-5 h-5 border-t-[3px] border-l-[3px] border-amber-400 -translate-x-px -translate-y-px" />
                <div className="absolute top-0 right-0 w-5 h-5 border-t-[3px] border-r-[3px] border-amber-400 translate-x-px -translate-y-px" />
                <div className="absolute bottom-0 left-0 w-5 h-5 border-b-[3px] border-l-[3px] border-amber-400 -translate-x-px translate-y-px" />
                <div className="absolute bottom-0 right-0 w-5 h-5 border-b-[3px] border-r-[3px] border-amber-400 translate-x-px translate-y-px" />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-4 pb-6 pt-3 shrink-0">
            {item.tagCrop && (
              <button onClick={removeCrop} className="flex-1 h-[48px] border border-red-500/40 text-red-400 rounded-lg text-sm">
                Remove Tag
              </button>
            )}
            <button onClick={saveCropToItem} className="flex-1 h-[48px] bg-amber-500 text-black font-bold rounded-lg text-sm">
              Save Crop
            </button>
          </div>
        </div>
      )}
    </>
  )
}
