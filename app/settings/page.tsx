'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface TrashInfo {
  count: number
  totalPhotos: number
}

export default function SettingsPage() {
  const router = useRouter()
  const [trash, setTrash] = useState<TrashInfo | null>(null)
  const [emptying, setEmptying] = useState(false)
  const [localCount, setLocalCount] = useState<number | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('stagr-items')
      const items = raw ? JSON.parse(raw) : []
      setLocalCount(Array.isArray(items) ? items.length : 0)
    } catch {
      setLocalCount(0)
    }
    fetch('/api/trash')
      .then(r => r.json())
      .then(d => setTrash({ count: d.count ?? 0, totalPhotos: d.totalPhotos ?? 0 }))
      .catch(() => setTrash({ count: 0, totalPhotos: 0 }))
  }, [])

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      // Step 1: scan localStorage — find items + any photo data
      setSyncResult('Step 1: scanning device storage…')

      const raw = localStorage.getItem('stagr-items')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const local: any[] = raw ? JSON.parse(raw) : []
      if (!local.length) {
        setSyncResult('Nothing found on this device to sync.')
        setSyncing(false)
        return
      }

      // Collect all localStorage keys so we can spot separate photo stores
      const allKeys = Object.keys(localStorage)
      const otherKeys = allKeys.filter(k => k !== 'stagr-items')

      // Tally photo formats in items array
      let base64Count = 0
      let cloudinaryCount = 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const item of local) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const p of (item.photos ?? [])) {
          const url = typeof p === 'string' ? p : p?.url
          if (typeof url === 'string' && url.startsWith('https://')) cloudinaryCount++
          else if (typeof url === 'string' && url.startsWith('data:')) base64Count++
          else if (typeof p === 'string' && p.startsWith('data:')) base64Count++
        }
      }

      const step1 = [
        `${local.length} item(s)`,
        `${cloudinaryCount} cloudinary photo(s)`,
        `${base64Count} base64 photo(s)`,
        otherKeys.length ? `other keys: ${otherKeys.join(', ')}` : 'no other keys',
      ].join(' · ')

      setSyncResult(`Step 1: ${step1}`)
      await new Promise(r => setTimeout(r, 6000)) // pause long enough to read + screenshot

      // Build clean items — upload base64 photos to Cloudinary on the way
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async function uploadBase64(dataUrl: string): Promise<{ url: string; publicId: string } | null> {
        if (!cloudName || !uploadPreset) return null
        try {
          const fd = new FormData()
          fd.append('file', dataUrl)
          fd.append('upload_preset', uploadPreset)
          fd.append('folder', 'stagr')
          const r = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: 'POST', body: fd,
          })
          const d = await r.json()
          if (d.secure_url) return { url: d.secure_url, publicId: d.public_id ?? '' }
        } catch { /* skip failed upload */ }
        return null
      }

      let uploaded = 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clean: any[] = []

      for (const item of local) {
        if (!item?.id) continue
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const photos: { url: string; publicId: string }[] = []

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const p of (item.photos ?? [])) {
          const url = typeof p === 'string' ? p : p?.url
          const publicId = p?.publicId ?? ''
          if (typeof url === 'string' && url.startsWith('https://')) {
            photos.push({ url, publicId })
          } else if (typeof url === 'string' && url.startsWith('data:')) {
            setSyncResult(`Uploading photo ${uploaded + 1}…`)
            const result = await uploadBase64(url)
            if (result) { photos.push(result); uploaded++ }
          }
        }

        clean.push({
          id: String(item.id),
          sku: String(item.sku ?? ''),
          dateAdded: String(item.dateAdded ?? new Date().toISOString()),
          photos,
        })
      }

      setSyncResult(`Step 2: pushing ${clean.length} items (${uploaded} photos uploaded) to cloud…`)

      const pushRes = await fetch('/api/sync-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: clean }),
      })

      if (!pushRes.ok) {
        const errData = await pushRes.json().catch(() => ({}))
        throw new Error(errData.reason || `Server error ${pushRes.status}`)
      }

      const result = await pushRes.json()
      setSyncResult(
        result.added > 0
          ? `Done! ${result.added} item(s) pushed to cloud.${uploaded > 0 ? ` ${uploaded} photo(s) uploaded.` : ''}`
          : 'Already up to date.'
      )
    } catch (err) {
      setSyncResult('Error: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSyncing(false)
    }
  }

  async function handleEmptyTrash() {
    if (!trash || trash.count === 0) return
    const msg = `Permanently delete ${trash.count} listed item${trash.count !== 1 ? 's' : ''} and ${trash.totalPhotos} photo${trash.totalPhotos !== 1 ? 's' : ''} from Cloudinary? This cannot be undone.`
    if (!window.confirm(msg)) return
    setEmptying(true)
    try {
      const res = await fetch('/api/trash', { method: 'DELETE' })
      if (!res.ok) throw new Error('Server error')
      setTrash({ count: 0, totalPhotos: 0 })
    } catch {
      alert('Failed to empty trash. Try again.')
    } finally {
      setEmptying(false)
    }
  }

  return (
    <main className="px-4 pt-6 pb-6">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => router.back()} className="text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-xl font-bold">Settings</h1>
      </div>

      {/* Cloud Sync */}
      <section className="mb-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Cloud Sync</h2>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-4">
          <p className="text-sm text-gray-300 mb-1">
            {localCount === null ? 'Checking…' : `${localCount} item${localCount !== 1 ? 's' : ''} on this device`}
          </p>
          <p className="text-xs text-gray-500 mb-4">
            Pushes anything saved on this device up to the cloud so it appears everywhere.
          </p>
          {syncResult && (
            <p className="text-xs text-amber-400 mb-3">{syncResult}</p>
          )}
          <button
            onClick={handleSync}
            disabled={syncing || localCount === 0}
            className="w-full h-[44px] bg-[#1a1a1a] border border-amber-500/40 text-amber-400 text-sm font-semibold rounded-lg active:opacity-80 disabled:opacity-40 transition-opacity"
          >
            {syncing ? 'Syncing…' : 'Push This Device to Cloud'}
          </button>
        </div>
      </section>

      {/* Trash */}
      <section className="mb-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Listed Items Trash</h2>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-4">
          {trash === null ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : trash.count === 0 ? (
            <p className="text-sm text-gray-500">Trash is empty.</p>
          ) : (
            <>
              <p className="text-sm text-gray-300 mb-1">
                <span className="font-semibold text-white">{trash.count}</span> listed item{trash.count !== 1 ? 's' : ''} waiting to be deleted
              </p>
              <p className="text-xs text-gray-500 mb-4">
                {trash.totalPhotos} photo{trash.totalPhotos !== 1 ? 's' : ''} · Auto-deleted after 48 hours
              </p>
              <button
                onClick={handleEmptyTrash}
                disabled={emptying}
                className="w-full h-[44px] bg-[#1a1a1a] border border-red-500/40 text-red-400 text-sm font-semibold rounded-lg active:opacity-80 disabled:opacity-50 transition-opacity"
              >
                {emptying ? 'Deleting…' : 'Empty Trash Now'}
              </button>
            </>
          )}
        </div>
        <p className="text-xs text-gray-600 mt-2 px-1">
          When you mark an item as listed, its photos stay in trash for 48 hours before auto-deleting. Use &ldquo;Empty Trash Now&rdquo; to delete them immediately.
        </p>
      </section>

      {/* About */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">About</h2>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-4 space-y-1">
          <p className="text-sm font-medium">Stagr</p>
          <p className="text-xs text-gray-500">Version 1.1</p>
          <p className="text-xs text-gray-500">stagr.timothyhales.com</p>
        </div>
      </section>
    </main>
  )
}
