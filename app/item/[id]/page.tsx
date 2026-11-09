'use client'

import { useState, useRef } from 'react'
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
  const { items, deleteItem, markListed, updateItem } = useItems()
  const [downloading, setDownloading] = useState(false)
  const [listing, setListing] = useState(false)
  const [scanning, setScanning] = useState(false)

  // Crop state
  const [cropPhotoIdx, setCropPhotoIdx] = useState<number | null>(null)
  const [pendingCrop, setPendingCrop] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const cropContainerRef = useRef<HTMLDivElement>(null)
  const cropRectRef = useRef<DOMRect | null>(null)

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

  // ── Style code scan ──────────────────────────────────────────────────────────
  async function handleScanStyleCode() {
    setScanning(true)
    let found: string | null = null

    // If a tag crop is set, only scan that photo — it's the one with the tag
    const tagPhotoName = item.tagCrop?.photoName
    const photosToScan = tagPhotoName
      ? item.photos.filter((_, i) => `photo_${i + 1}` === tagPhotoName)
      : item.photos

    for (const photo of photosToScan) {
      const res = await fetch('/api/scan-style-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoUrl: photo.url }),
      })
      const data = await res.json()
      if (data.styleCode) { found = data.styleCode; break }
    }
    if (found) {
      updateItem(item.id, { styleCode: found })
    } else {
      alert('No style code found.')
    }
    setScanning(false)
  }

  // ── Crop handlers ────────────────────────────────────────────────────────────
  function openCrop(idx: number) {
    setCropPhotoIdx(idx)
    // Pre-fill with existing crop if this photo already has one
    const photoName = `photo_${idx + 1}`
    if (item.tagCrop?.photoName === photoName) {
      setPendingCrop({ x1: item.tagCrop.x1, y1: item.tagCrop.y1, x2: item.tagCrop.x2, y2: item.tagCrop.y2 })
    } else {
      setPendingCrop(null)
    }
  }

  function closeCrop() {
    setCropPhotoIdx(null)
    setPendingCrop(null)
    setIsDragging(false)
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    cropRectRef.current = cropContainerRef.current?.getBoundingClientRect() ?? null
    if (!cropRectRef.current) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setIsDragging(true)
    const r = cropRectRef.current
    setDragStart({
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    })
    setPendingCrop(null)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging || !cropRectRef.current) return
    const r = cropRectRef.current
    const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
    const y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))
    setPendingCrop({ x1: dragStart.x, y1: dragStart.y, x2: x, y2: y })
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging || !cropRectRef.current) return
    setIsDragging(false)
    const r = cropRectRef.current
    const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
    const y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))
    const crop = { x1: dragStart.x, y1: dragStart.y, x2: x, y2: y }
    const big = Math.abs(crop.x2 - crop.x1) > 0.04 && Math.abs(crop.y2 - crop.y1) > 0.04
    setPendingCrop(big ? crop : null)
  }

  function saveCropToItem() {
    if (cropPhotoIdx === null || !pendingCrop) return
    updateItem(item.id, {
      tagCrop: { photoName: `photo_${cropPhotoIdx + 1}`, ...pendingCrop },
    })
    closeCrop()
  }

  function removeCrop() {
    updateItem(item.id, { tagCrop: null })
    closeCrop()
  }

  // Selection rect (normalized → percent)
  const selLeft   = pendingCrop ? Math.min(pendingCrop.x1, pendingCrop.x2) * 100 : 0
  const selTop    = pendingCrop ? Math.min(pendingCrop.y1, pendingCrop.y2) * 100 : 0
  const selWidth  = pendingCrop ? Math.abs(pendingCrop.x2 - pendingCrop.x1) * 100 : 0
  const selHeight = pendingCrop ? Math.abs(pendingCrop.y2 - pendingCrop.y1) * 100 : 0

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
          <h1 className="text-2xl font-bold font-mono">{item.sku || 'No SKU'}</h1>
          <p className="text-xs text-gray-500 mt-1">Added {formattedDate}</p>
          {item.tagCrop && (
            <p className="text-xs text-amber-500 mt-1">✂ Tag crop set on {item.tagCrop.photoName}</p>
          )}
          <div className="flex items-center gap-3 mt-2">
            {item.styleCode ? (
              <p className="text-xs text-blue-400 font-mono">{item.styleCode}</p>
            ) : null}
            <button
              onClick={handleScanStyleCode}
              disabled={scanning || item.photos.length === 0}
              className="text-xs text-blue-400 border border-blue-400/30 rounded px-2 py-0.5 disabled:opacity-40 active:opacity-60"
            >
              {scanning ? 'Scanning…' : item.styleCode ? '↺ Re-scan' : '🔍 Scan Style Code'}
            </button>
          </div>
        </div>

        {/* Photos */}
        {item.photos.length > 0 ? (
          <div className="mb-6">
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
                    {/* Crop badge */}
                    {hasCrop && (
                      <div className="absolute top-1.5 left-1.5 bg-amber-400 text-black text-[10px] font-bold px-1.5 py-0.5 rounded pointer-events-none">
                        ✂ tag
                      </div>
                    )}
                    {/* Crop button */}
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
          </div>
        ) : (
          <div className="mb-6 py-10 text-center border border-dashed border-[#2a2a2a] rounded-lg">
            <p className="text-sm text-gray-600">No photos on this item.</p>
          </div>
        )}

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
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] flex-shrink-0">
            <button onClick={closeCrop} className="text-gray-400 text-sm min-w-[60px]">
              Cancel
            </button>
            <span className="text-xs text-gray-500">Drag to crop the tag label</span>
            <button
              onClick={saveCropToItem}
              disabled={!pendingCrop}
              className="text-amber-400 text-sm font-semibold min-w-[60px] text-right disabled:opacity-30"
            >
              Save
            </button>
          </div>

          {/* Image + drag area */}
          <div className="flex-1 flex items-center justify-center overflow-hidden p-4">
            <div
              ref={cropContainerRef}
              className="relative w-full select-none cursor-crosshair"
              style={{ touchAction: 'none' }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.photos[cropPhotoIdx].url}
                alt="crop"
                className="w-full h-auto max-h-[65vh] object-contain block pointer-events-none"
                draggable={false}
              />
              {/* Dark overlay + selection */}
              {pendingCrop && (
                <>
                  {/* Full dark overlay */}
                  <div className="absolute inset-0 bg-black/55 pointer-events-none" />
                  {/* Clear selection window */}
                  <div
                    className="absolute border-2 border-amber-400 pointer-events-none"
                    style={{
                      left: `${selLeft}%`,
                      top: `${selTop}%`,
                      width: `${selWidth}%`,
                      height: `${selHeight}%`,
                      mixBlendMode: 'normal',
                      boxShadow: 'inset 0 0 0 9999px transparent',
                      background: 'transparent',
                    }}
                  />
                  {/* Punch through — re-draw the visible region on top */}
                  <div
                    className="absolute pointer-events-none overflow-hidden border-2 border-amber-400"
                    style={{
                      left: `${selLeft}%`,
                      top: `${selTop}%`,
                      width: `${selWidth}%`,
                      height: `${selHeight}%`,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.photos[cropPhotoIdx].url}
                      alt=""
                      className="absolute pointer-events-none"
                      draggable={false}
                      style={{
                        left: `-${selLeft}%`,
                        top: `-${selTop}%`,
                        width: `${100 / (selWidth / 100)}%`,
                        height: 'auto',
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 px-4 pb-8 pt-3 text-center space-y-3">
            {pendingCrop ? (
              <button
                onClick={() => setPendingCrop(null)}
                className="text-gray-500 text-sm"
              >
                Clear selection
              </button>
            ) : (
              <p className="text-gray-600 text-sm">Drag over the brand tag area</p>
            )}
            {item.tagCrop && (
              <button
                onClick={removeCrop}
                className="block mx-auto text-red-400/50 text-xs"
              >
                Remove saved crop
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
