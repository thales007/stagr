'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useItems, Photo } from '@/hooks/useItems'
import { uploadPhoto } from '@/lib/cloudinary'

const DRAFT_KEY = 'stagr-add-draft'

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveDraft(data: object) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)) } catch { /* noop */ }
}

function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY) } catch { /* noop */ }
}

export default function AddItemPage() {
  const router = useRouter()
  const { addItem } = useItems()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [sku, setSku] = useState('')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [uploading, setUploading] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [justCaptured, setJustCaptured] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [draftLoaded, setDraftLoaded] = useState(false)

  // Restore draft on mount
  useEffect(() => {
    const draft = loadDraft()
    if (draft) {
      if (draft.sku) setSku(draft.sku)
      if (draft.photos) setPhotos(draft.photos)
    }
    setDraftLoaded(true)
  }, [])

  // Save draft whenever form changes
  useEffect(() => {
    if (!draftLoaded) return
    saveDraft({ sku, photos })
  }, [sku, photos, draftLoaded])

  // Attach stream to video element when camera becomes active
  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {
        setCameraError('Could not start video preview.')
      })
    }
  }, [cameraActive])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraActive(false)
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  async function startCamera() {
    setCameraError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1920 } },
        audio: false,
      })
      streamRef.current = stream
      setCameraActive(true)
    } catch {
      setCameraError('Camera access was denied. Tap the camera icon in your browser address bar to allow it.')
    }
  }

  function capturePhoto() {
    const video = videoRef.current
    if (!video || video.readyState < 2) return

    const size = Math.min(video.videoWidth, video.videoHeight)
    if (size === 0) return

    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    const x = (video.videoWidth - size) / 2
    const y = (video.videoHeight - size) / 2
    ctx.drawImage(video, x, y, size, size, 0, 0, size, size)

    setJustCaptured(true)
    setTimeout(() => setJustCaptured(false), 120)

    canvas.toBlob(async blob => {
      if (!blob) return
      const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' })
      setUploading(true)
      try {
        const result = await uploadPhoto(file)
        setPhotos(prev => [...prev, result])
      } catch (err) {
        setCameraError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setUploading(false)
      }
    }, 'image/jpeg', 0.92)
  }

  async function removePhoto(photo: Photo) {
    setPhotos(prev => prev.filter(p => p.publicId !== photo.publicId))
    try {
      await fetch('/api/delete-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicId: photo.publicId }),
      })
    } catch { /* best-effort */ }
  }

  async function handleSave() {
    if (!sku.trim()) { setError('SKU is required'); return }
    setError('')
    setSaving(true)
    stopCamera()
    clearDraft()
    addItem({ sku: sku.trim(), photos })
    await new Promise(resolve => setTimeout(resolve, 400))
    router.push('/')
  }

  return (
    <main className="px-4 pt-6 pb-6">
      <h1 className="text-xl font-bold mb-6">Add Item</h1>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* Photos */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm text-gray-400">Photos</label>
            {cameraActive && (
              <button type="button" onClick={stopCamera} className="text-xs text-gray-500 underline">
                Close camera
              </button>
            )}
          </div>

          {/* Video element — always in DOM so ref is ready when stream arrives */}
          <div className={cameraActive ? 'space-y-3' : 'hidden'}>
            <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transition-opacity duration-75 ${justCaptured ? 'opacity-0' : 'opacity-100'}`}
              />
              {uploading && (
                <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                  <span className="bg-black/60 text-white text-xs px-3 py-1 rounded-full">Uploading...</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex gap-2 overflow-x-auto flex-1 pb-1 min-h-[56px]">
                {photos.map(photo => (
                  <div key={photo.publicId} className="relative shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt="" className="w-14 h-14 object-cover rounded-lg" />
                    <button
                      type="button"
                      onClick={() => removePhoto(photo)}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={capturePhoto}
                disabled={uploading}
                className="shrink-0 w-16 h-16 rounded-full bg-white border-4 border-gray-300 active:scale-90 transition-transform disabled:opacity-50"
                aria-label="Take photo"
              />
            </div>

            {cameraError && <p className="text-xs text-red-400">{cameraError}</p>}
          </div>

          {/* Open camera button — shown when camera is closed */}
          {!cameraActive && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={startCamera}
                className="w-full h-[80px] bg-[#1a1a1a] border-2 border-dashed border-[#2a2a2a] rounded-lg flex items-center justify-center gap-3 text-amber-500 active:opacity-70"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span className="font-medium text-sm">
                  {photos.length === 0 ? 'Open Camera' : `${photos.length} photo${photos.length !== 1 ? 's' : ''} — tap to add more`}
                </span>
              </button>

              {cameraError && <p className="text-xs text-red-400">{cameraError}</p>}

              {photos.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {photos.map(photo => (
                    <div key={photo.publicId} className="relative shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt="" className="w-20 h-20 object-cover rounded-lg" />
                      <button
                        type="button"
                        onClick={() => removePhoto(photo)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* SKU */}
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">SKU</label>
          <input
            type="text"
            placeholder="e.g. NK-AM90-WHT-10"
            value={sku}
            onChange={e => setSku(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white text-base px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 h-[52px] placeholder:text-gray-600"
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving || uploading}
        className="mt-8 w-full h-[56px] bg-amber-500 text-black font-bold text-base rounded-lg active:opacity-80 disabled:opacity-50 transition-opacity"
      >
        {saving ? 'Saving...' : 'Save Item'}
      </button>
    </main>
  )
}
