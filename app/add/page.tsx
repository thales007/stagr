'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useItems, Photo } from '@/hooks/useItems'
import { uploadPhoto } from '@/lib/cloudinary'
import type { Worker as TesseractWorker } from 'tesseract.js'

const DRAFT_KEY = 'stagr-add-draft'

interface SheetLink {
  row: number
  title: string
  cost: number
}

function todayMMDDYY(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(2)
  return `${mm}${dd}${yy}`
}

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
  const [condition, setCondition] = useState<'new' | 'used'>('used')
  const [sheetLinked, setSheetLinked] = useState<SheetLink | null>(null)
  const [uploading, setUploading] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [justCaptured, setJustCaptured] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [draftLoaded, setDraftLoaded] = useState(false)
  const [scanState, setScanState] = useState<'idle' | 'loading' | 'scanning'>('idle')
  const [scanResult, setScanResult] = useState<'ok' | 'miss' | null>(null)
  const ocrWorker = useRef<TesseractWorker | null>(null)

  // On mount: check URL params for pre-linked sheet item, else restore draft
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sheetRow = params.get('sheetRow')

    if (sheetRow) {
      // Started from "To Be Listed" — use URL params, ignore draft
      setSheetLinked({
        row: parseInt(sheetRow),
        title: params.get('sheetTitle') || '',
        cost: parseFloat(params.get('sheetCost') || '0') || 0,
      })
    } else {
      const draft = loadDraft()
      if (draft) {
        if (draft.sku) setSku(draft.sku)
        if (draft.photos) setPhotos(draft.photos)
        if (draft.condition) setCondition(draft.condition as 'new' | 'used')
        if (draft.sheetLinked) setSheetLinked(draft.sheetLinked)
      }
    }

    setDraftLoaded(true)
    startCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Save draft whenever form changes (only when not URL-initiated)
  useEffect(() => {
    if (!draftLoaded) return
    saveDraft({ sku, photos, condition, sheetLinked })
  }, [sku, photos, condition, sheetLinked, draftLoaded])

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

  useEffect(() => () => {
    stopCamera()
    ocrWorker.current?.terminate().catch(() => {})
  }, [stopCamera])

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

  async function scanSku() {
    if (!cameraActive) {
      await startCamera()
      return
    }
    const video = videoRef.current
    if (!video || video.readyState < 2) return

    setScanResult(null)

    // Lazy-init the OCR worker (downloads ~4MB model on first ever call, cached after)
    if (!ocrWorker.current) {
      setScanState('loading')
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('eng')
      await worker.setParameters({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tessedit_pageseg_mode: '7' as any,
      })
      ocrWorker.current = worker
    }

    setScanState('scanning')

    // Capture center strip of the frame where the sticker is most likely held
    const canvas = document.createElement('canvas')
    const cropW = video.videoWidth
    const cropH = Math.round(video.videoHeight * 0.4)
    const cropY = Math.round(video.videoHeight * 0.3)
    canvas.width = cropW
    canvas.height = cropH
    canvas.getContext('2d')!.drawImage(video, 0, cropY, cropW, cropH, 0, 0, cropW, cropH)

    try {
      const { data: { text } } = await ocrWorker.current.recognize(canvas)
      const cleaned = text.replace(/[^A-Z0-9]/gi, '').toUpperCase().trim()
      if (cleaned) {
        setSku(cleaned)
        setScanResult('ok')
      } else {
        setScanResult('miss')
      }
    } catch {
      setScanResult('miss')
    } finally {
      setScanState('idle')
      setTimeout(() => setScanResult(null), 2000)
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

  async function handleClear() {
    stopCamera()
    await Promise.all(
      photos.map(photo =>
        fetch('/api/delete-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publicId: photo.publicId }),
        }).catch(() => {})
      )
    )
    setSku('')
    setPhotos([])
    setCondition('used')
    setSheetLinked(null)
    setError('')
    clearDraft()
  }

  async function handleSave() {
    if (!sku.trim()) { setError('SKU is required'); return }
    setError('')
    setSaving(true)
    stopCamera()
    clearDraft()
    addItem({
      sku: `${sku.trim()} ${todayMMDDYY()}`,
      photos,
      condition,
      sheetRow: sheetLinked?.row,
      sheetTitle: sheetLinked?.title,
      sheetCost: sheetLinked?.cost,
    })
    await new Promise(resolve => setTimeout(resolve, 400))
    router.push('/')
  }

  return (
    <main className="px-4 pt-6 pb-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Add Item</h1>
        {(sku || photos.length > 0) && (
          <button
            type="button"
            onClick={handleClear}
            className="text-sm text-red-400 active:opacity-60"
          >
            Clear
          </button>
        )}
      </div>

      {/* Pre-linked sheet item */}
      {sheetLinked && (
        <div className="mb-4 px-3 py-2.5 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-center justify-between">
          <div>
            <p className="text-sm text-blue-300 font-medium">{sheetLinked.title}</p>
            <p className="text-xs text-gray-500 mt-0.5">Cost: ${sheetLinked.cost.toFixed(2)}</p>
          </div>
          <button
            type="button"
            onClick={() => setSheetLinked(null)}
            className="text-xs text-gray-600 underline ml-3"
          >
            Unlink
          </button>
        </div>
      )}

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

        {/* Condition */}
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Condition</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCondition('used')}
              className={`flex-1 h-[44px] rounded-lg border font-medium text-sm transition-colors ${
                condition === 'used'
                  ? 'border-amber-500 text-amber-500 bg-amber-500/10'
                  : 'border-[#2a2a2a] text-gray-500 bg-[#1a1a1a]'
              }`}
            >
              Used
            </button>
            <button
              type="button"
              onClick={() => setCondition('new')}
              className={`flex-1 h-[44px] rounded-lg border font-medium text-sm transition-colors ${
                condition === 'new'
                  ? 'border-green-500 text-green-500 bg-green-500/10'
                  : 'border-[#2a2a2a] text-gray-500 bg-[#1a1a1a]'
              }`}
            >
              New
            </button>
          </div>
        </div>

        {/* SKU */}
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">SKU</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. 0510 or G01278"
              value={sku}
              onChange={e => setSku(e.target.value)}
              className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] text-white text-base px-4 rounded-lg focus:outline-none focus:border-amber-500 h-[52px] placeholder:text-gray-600"
            />
            <button
              type="button"
              onClick={scanSku}
              disabled={scanState !== 'idle'}
              className="shrink-0 h-[52px] px-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-amber-500 disabled:opacity-50 flex flex-col items-center justify-center gap-0.5"
              aria-label="Scan SKU sticker"
            >
              {scanState === 'loading' ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
              ) : scanState === 'scanning' ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 12h8M12 8v8"/></svg>
              ) : scanResult === 'ok' ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              ) : scanResult === 'miss' ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>
                  <line x1="7" y1="12" x2="17" y2="12"/>
                </svg>
              )}
              <span className="text-[10px] leading-none">
                {scanState === 'loading' ? 'Loading' : scanState === 'scanning' ? 'Reading' : !cameraActive ? 'Camera' : 'Scan'}
              </span>
            </button>
          </div>
          {sku.trim() && (
            <p className="mt-1.5 text-xs text-gray-500">
              Saves as <span className="text-amber-400 font-mono">{sku.trim()} {todayMMDDYY()}</span>
            </p>
          )}
          {!cameraActive && scanState === 'idle' && !sku && (
            <p className="mt-1.5 text-xs text-gray-500">Tap Scan to open camera and read the SKU sticker</p>
          )}
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
