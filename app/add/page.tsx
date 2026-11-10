'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useItems, Photo, TagCrop } from '@/hooks/useItems'
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
  const [saveLabel, setSaveLabel] = useState('Save Item')
  const [draftLoaded, setDraftLoaded] = useState(false)
  const [scanState, setScanState] = useState<'idle' | 'aiming' | 'loading' | 'scanning'>('idle')
  const [scanResult, setScanResult] = useState<'ok' | 'miss' | null>(null)
  const ocrWorker = useRef<TesseractWorker | null>(null)
  const aimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Crop state
  const [cropOpen, setCropOpen] = useState(false)
  const [cropPhotoIdx, setCropPhotoIdx] = useState<number | null>(null)
  const cropContainerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const viewfinderRef = useRef<HTMLDivElement>(null)
  const [imgScale, setImgScale] = useState(1)
  const [imgOffset, setImgOffset] = useState({ x: 0, y: 0 })
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  const lastPinchDistRef = useRef(0)
  const lastPinchMidRef = useRef({ x: 0, y: 0 })
  const [tagPhotoIdx, setTagPhotoIdx] = useState<number | null>(null)
  const [savedTagCrop, setSavedTagCrop] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)

  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickAddDesc, setQuickAddDesc] = useState('')
  const [quickAddCost, setQuickAddCost] = useState('')
  const [addingToSheet, setAddingToSheet] = useState(false)

  // On mount: check URL params for pre-linked sheet item, else restore draft
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sheetRow = params.get('sheetRow')

    if (sheetRow) {
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

  // Save draft whenever form changes
  useEffect(() => {
    if (!draftLoaded) return
    saveDraft({ sku, photos, condition, sheetLinked })
  }, [sku, photos, condition, sheetLinked, draftLoaded])

  // Attach stream to video element
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
    if (aimTimerRef.current) clearTimeout(aimTimerRef.current)
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

  function preprocessForOCR(src: HTMLCanvasElement): HTMLCanvasElement {
    const out = document.createElement('canvas')
    out.width = src.width * 2
    out.height = src.height * 2
    const ctx = out.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(src, 0, 0, out.width, out.height)
    const img = ctx.getImageData(0, 0, out.width, out.height)
    const d = img.data
    let sum = 0
    for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    const thresh = Math.max(80, Math.min(200, (sum / (d.length / 4)) * 0.9))
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      const v = g > thresh ? 255 : 0
      d[i] = d[i + 1] = d[i + 2] = v
      d[i + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
    return out
  }

  async function runOCR() {
    const video = videoRef.current
    if (!video || video.readyState < 2) return

    setScanResult(null)

    if (!ocrWorker.current) {
      setScanState('loading')
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('eng')
      await worker.setParameters({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tessedit_pageseg_mode: '11' as any,
      })
      ocrWorker.current = worker
    }

    setScanState('scanning')

    const raw = document.createElement('canvas')
    const sx = Math.round(video.videoWidth * 0.10)
    const sy = Math.round(video.videoHeight * 0.35)
    const sw = Math.round(video.videoWidth * 0.80)
    const sh = Math.round(video.videoHeight * 0.30)
    raw.width = sw
    raw.height = sh
    raw.getContext('2d')!.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh)

    const processed = preprocessForOCR(raw)

    try {
      const { data: { text } } = await ocrWorker.current.recognize(processed)
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
      setTimeout(() => setScanResult(null), 2500)
    }
  }

  async function scanSku() {
    if (!cameraActive) {
      await startCamera()
      setScanState('aiming')
      aimTimerRef.current = setTimeout(runOCR, 2000)
      return
    }
    if (scanState === 'idle') {
      setScanState('aiming')
      aimTimerRef.current = setTimeout(runOCR, 2000)
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
    const idx = photos.findIndex(p => p.publicId === photo.publicId)
    setPhotos(prev => prev.filter(p => p.publicId !== photo.publicId))
    // Clear tag crop if the tagged photo was removed
    if (idx === tagPhotoIdx) {
      setTagPhotoIdx(null)
      setSavedTagCrop(null)
    }
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
    setTagPhotoIdx(null)
    setSavedTagCrop(null)
    setShowQuickAdd(false)
    setQuickAddDesc('')
    setQuickAddCost('')
    clearDraft()
  }

  async function handleAddToSheet() {
    if (!quickAddDesc.trim()) return
    setAddingToSheet(true)
    setError('')
    try {
      const cost = parseFloat(quickAddCost) || 0
      const today = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })
      const res = await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addRow', item: quickAddDesc.trim(), cost, datePurchased: today }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSheetLinked({ row: data.row, title: quickAddDesc.trim(), cost })
      setShowQuickAdd(false)
      setQuickAddDesc('')
      setQuickAddCost('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add to sheet')
    } finally {
      setAddingToSheet(false)
    }
  }

  // ── Crop handlers ────────────────────────────────────────────────────────────
  function openCrop(idx: number) {
    setCropPhotoIdx(idx)
    setImgScale(1)
    setImgOffset({ x: 0, y: 0 })
    pointersRef.current.clear()
    setCropOpen(true)
  }

  function closeCrop() {
    setCropOpen(false)
    setCropPhotoIdx(null)
    pointersRef.current.clear()
  }

  function onImgPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointersRef.current.size === 2) {
      const pts = [...pointersRef.current.values()]
      lastPinchDistRef.current = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)
      lastPinchMidRef.current = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
    }
  }

  function onImgPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(e.pointerId)) return
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointersRef.current.size === 2) {
      const pts = [...pointersRef.current.values()]
      const newDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)
      const newMid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
      if (lastPinchDistRef.current > 0) {
        const factor = newDist / lastPinchDistRef.current
        setImgScale(s => Math.max(0.5, Math.min(5, s * factor)))
        const dx = newMid.x - lastPinchMidRef.current.x
        const dy = newMid.y - lastPinchMidRef.current.y
        setImgOffset(o => ({ x: o.x + dx, y: o.y + dy }))
      }
      lastPinchDistRef.current = newDist
      lastPinchMidRef.current = newMid
    } else if (pointersRef.current.size === 1) {
      const prev = [...pointersRef.current.values()][0]
      const dx = e.clientX - prev.x
      const dy = e.clientY - prev.y
      setImgOffset(o => ({ x: o.x + dx, y: o.y + dy }))
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    }
  }

  function onImgPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(e.pointerId)
    if (pointersRef.current.size < 2) lastPinchDistRef.current = 0
  }

  function computeCropRect() {
    const containerEl = cropContainerRef.current
    const img = imgRef.current
    const vf = viewfinderRef.current
    if (!containerEl || !img || !vf) return null
    const r = containerEl.getBoundingClientRect()
    const v = vf.getBoundingClientRect()
    const cW = r.width, cH = r.height
    const natW = img.naturalWidth, natH = img.naturalHeight
    if (!natW || !natH) return null
    const base = Math.min(cW / natW, cH / natH)
    const dW = natW * base, dH = natH * base
    const iL = (cW - dW) / 2, iT = (cH - dH) / 2
    const s = imgScale, ox = imgOffset.x, oy = imgOffset.y
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

  function saveCrop() {
    if (cropPhotoIdx === null) return
    const rect = computeCropRect()
    if (!rect) return
    setTagPhotoIdx(cropPhotoIdx)
    setSavedTagCrop(rect)
    closeCrop()
  }

  function removeCrop() {
    setTagPhotoIdx(null)
    setSavedTagCrop(null)
    closeCrop()
  }

  // ── Save ─────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!sku.trim()) { setError('SKU is required'); return }
    setError('')
    setSaving(true)
    stopCamera()

    let styleCode: string | null = null
    let tagCrop: TagCrop | null = null

    if (photos.length > 0) {
      // Determine which photo to scan: tagged one or first photo
      const scanIdx = tagPhotoIdx ?? 0
      const scanPhoto = photos[scanIdx]

      if (savedTagCrop && tagPhotoIdx !== null) {
        tagCrop = {
          photoName: `photo_${tagPhotoIdx + 1}`,
          ...savedTagCrop,
        }
      }

      // If there's a crop, build a Cloudinary URL that pre-crops to the tag region
      let photoUrlToScan = scanPhoto.url
      if (savedTagCrop && tagPhotoIdx !== null) {
        const { x1, y1, x2, y2 } = savedTagCrop
        const w = x2 - x1
        const h = y2 - y1
        const uploadIdx = scanPhoto.url.indexOf('/upload/')
        if (uploadIdx !== -1) {
          const before = scanPhoto.url.substring(0, uploadIdx + 8)
          const after = scanPhoto.url.substring(uploadIdx + 8)
          photoUrlToScan = `${before}c_crop,fl_relative,x_${x1.toFixed(4)},y_${y1.toFixed(4)},w_${w.toFixed(4)},h_${h.toFixed(4)}/${after}`
        }
      }

      setSaveLabel('Scanning…')
      try {
        const res = await fetch('/api/scan-style-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photoUrl: photoUrlToScan }),
        })
        const data = await res.json()
        if (data.styleCode) styleCode = data.styleCode
      } catch { /* best-effort — save without style code */ }
    }

    setSaveLabel('Saving…')
    clearDraft()
    addItem({
      sku: `${sku.trim()} ${todayMMDDYY()}`,
      photos,
      condition,
      sheetRow: sheetLinked?.row,
      sheetTitle: sheetLinked?.title,
      sheetCost: sheetLinked?.cost,
      tagCrop,
      styleCode,
    })
    await new Promise(resolve => setTimeout(resolve, 400))
    router.push('/')
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Crop overlay */}
      {cropOpen && cropPhotoIdx !== null && photos[cropPhotoIdx] && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
            <button onClick={closeCrop} className="text-gray-400 text-sm min-w-[60px]">Cancel</button>
            <span className="text-xs text-gray-500">Pinch &amp; drag to frame the tag</span>
            <button onClick={saveCrop} className="text-amber-400 text-sm font-semibold min-w-[60px] text-right">Save</button>
          </div>

          {/* Image + fixed viewfinder */}
          <div
            ref={cropContainerRef}
            className="relative flex-1 overflow-hidden select-none touch-none"
            onPointerDown={onImgPointerDown}
            onPointerMove={onImgPointerMove}
            onPointerUp={onImgPointerUp}
            onPointerCancel={onImgPointerUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={photos[cropPhotoIdx].url}
              alt=""
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              draggable={false}
              style={{
                transform: `translate(${imgOffset.x}px, ${imgOffset.y}px) scale(${imgScale})`,
                transformOrigin: 'center center',
              }}
            />
            {/* Fixed viewfinder — box-shadow dims everything outside */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div
                ref={viewfinderRef}
                className="border-2 border-amber-400 relative"
                style={{
                  width: '60vmin',
                  height: '60vmin',
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)',
                }}
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
            {tagPhotoIdx !== null && (
              <button onClick={removeCrop} className="flex-1 h-[48px] border border-red-500/40 text-red-400 rounded-lg text-sm">
                Remove Tag
              </button>
            )}
            <button onClick={saveCrop} className="flex-1 h-[48px] bg-amber-500 text-black font-bold rounded-lg text-sm">
              Save Crop
            </button>
          </div>
        </div>
      )}

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
        {sheetLinked ? (
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
        ) : (
          <div className="mb-4">
            {!showQuickAdd ? (
              <button
                type="button"
                onClick={() => setShowQuickAdd(true)}
                className="text-sm text-blue-400 active:opacity-60"
              >
                + Add new purchase to spreadsheet
              </button>
            ) : (
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 space-y-2">
                <p className="text-xs text-gray-400 font-medium">New Purchase</p>
                <input
                  type="text"
                  placeholder="Item description (e.g. Jordan 1 Retro High)"
                  value={quickAddDesc}
                  onChange={e => setQuickAddDesc(e.target.value)}
                  className="w-full bg-[#111] border border-[#2a2a2a] text-white text-sm px-3 rounded-lg focus:outline-none focus:border-blue-500 h-[44px] placeholder:text-gray-600"
                />
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="Cost paid (e.g. 85)"
                  value={quickAddCost}
                  onChange={e => setQuickAddCost(e.target.value)}
                  className="w-full bg-[#111] border border-[#2a2a2a] text-white text-sm px-3 rounded-lg focus:outline-none focus:border-blue-500 h-[44px] placeholder:text-gray-600"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowQuickAdd(false); setQuickAddDesc(''); setQuickAddCost('') }}
                    className="flex-1 h-[40px] border border-[#2a2a2a] text-gray-400 rounded-lg text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddToSheet}
                    disabled={!quickAddDesc.trim() || addingToSheet}
                    className="flex-1 h-[40px] bg-blue-600 text-white font-semibold rounded-lg text-sm disabled:opacity-50 active:opacity-80"
                  >
                    {addingToSheet ? 'Adding...' : 'Add to Sheet'}
                  </button>
                </div>
              </div>
            )}
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
              <div className="flex gap-2 overflow-x-auto pb-1 min-h-[56px]">
                {photos.map((photo, i) => (
                  <div key={photo.publicId} className="relative shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url} alt=""
                      className="w-14 h-14 object-cover rounded-lg"
                      onClick={() => openCrop(i)}
                    />
                    {i === tagPhotoIdx && (
                      <div className="absolute top-0.5 left-0.5 bg-amber-400 text-black text-[9px] font-bold px-1 py-0.5 rounded pointer-events-none">✂</div>
                    )}
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

              <div
                className={`relative w-full aspect-square max-h-[40vh] rounded-lg overflow-hidden bg-black active:opacity-80 transition-opacity ${uploading ? 'cursor-default' : 'cursor-pointer'}`}
                onClick={() => { if (!uploading) capturePhoto() }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover transition-opacity duration-75 ${justCaptured ? 'opacity-0' : 'opacity-100'}`}
                />
                {/* SKU targeting overlay */}
                {(scanState === 'aiming' || scanState === 'loading' || scanState === 'scanning') && (
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 left-0 right-0 bg-black/50" style={{ height: '35%' }} />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50" style={{ height: '35%' }} />
                    <div className="absolute bg-black/50" style={{ top: '35%', bottom: '35%', left: 0, width: '10%' }} />
                    <div className="absolute bg-black/50" style={{ top: '35%', bottom: '35%', right: 0, width: '10%' }} />
                    <div className={`absolute border-2 transition-colors ${scanState === 'scanning' ? 'border-green-400' : 'border-amber-400'}`}
                      style={{ top: '35%', bottom: '35%', left: '10%', right: '10%' }} />
                    <p className="absolute text-white text-xs text-center w-full" style={{ top: '28%' }}>
                      {scanState === 'scanning' ? 'Reading...' : scanState === 'loading' ? 'Loading OCR...' : 'Position SKU sticker in box'}
                    </p>
                  </div>
                )}
                {uploading ? (
                  <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none">
                    <span className="bg-black/60 text-white text-xs px-3 py-1 rounded-full">Uploading...</span>
                  </div>
                ) : scanState === 'idle' && (
                  <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none">
                    <span className="text-white/30 text-[11px]">tap to capture</span>
                  </div>
                )}
              </div>

              {cameraError && <p className="text-xs text-red-400">{cameraError}</p>}
              {photos.length > 0 && tagPhotoIdx === null && (
                <p className="text-xs text-gray-500">Tap a photo to crop the tag label</p>
              )}
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
                    {photos.map((photo, i) => (
                      <div key={photo.publicId} className="relative shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.url} alt=""
                          className="w-20 h-20 object-cover rounded-lg"
                          onClick={() => openCrop(i)}
                        />
                        {i === tagPhotoIdx && (
                          <div className="absolute top-1 left-1 bg-amber-400 text-black text-[9px] font-bold px-1 py-0.5 rounded pointer-events-none">✂ tag</div>
                        )}
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
                {photos.length > 0 && tagPhotoIdx === null && (
                  <p className="text-xs text-gray-500">Tap a photo to crop the tag label</p>
                )}
              </div>
            )}
          </div>

          {/* SKU */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm text-gray-400">SKU</label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setCondition('used')}
                  className={`h-7 px-2.5 rounded-md border text-[11px] font-semibold transition-colors ${
                    condition === 'used'
                      ? 'border-amber-500 text-amber-500 bg-amber-500/10'
                      : 'border-[#2a2a2a] text-gray-500 bg-[#1a1a1a]'
                  }`}
                >Used</button>
                <button
                  type="button"
                  onClick={() => setCondition('new')}
                  className={`h-7 px-2.5 rounded-md border text-[11px] font-semibold transition-colors ${
                    condition === 'new'
                      ? 'border-green-500 text-green-500 bg-green-500/10'
                      : 'border-[#2a2a2a] text-gray-500 bg-[#1a1a1a]'
                  }`}
                >New</button>
              </div>
            </div>
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
                {scanState === 'loading' || scanState === 'scanning' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
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
                  {scanState === 'aiming' ? 'Hold...' : scanState === 'loading' || scanState === 'scanning' ? 'Reading' : !cameraActive ? 'Camera' : 'Scan'}
                </span>
              </button>
            </div>
            {sku.trim() && (
              <p className="mt-1.5 text-xs text-gray-500">
                Saves as <span className="text-amber-400 font-mono">{sku.trim()} {todayMMDDYY()}</span>
              </p>
            )}
          </div>

        </div>

        <button
          onClick={handleSave}
          disabled={saving || uploading}
          className="mt-4 w-full h-[56px] bg-amber-500 text-black font-bold text-base rounded-lg active:opacity-80 disabled:opacity-50 transition-opacity"
        >
          {saving ? saveLabel : 'Save Item'}
        </button>
      </main>
    </>
  )
}
