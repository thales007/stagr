'use client'

import { useEffect, useState } from 'react'

interface LocalItem {
  id: string
  sku?: string
  photos?: Array<{ url: string; publicId: string }>
}

type Status = 'idle' | 'pushing' | 'done' | 'error' | 'empty'

export default function MigratePage() {
  const [items, setItems] = useState<LocalItem[] | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<{ added: number; recovered: number } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    try {
      const raw = localStorage.getItem('stagr-items')
      const parsed: LocalItem[] = raw ? JSON.parse(raw) : []
      setItems(parsed.length > 0 ? parsed : [])
    } catch {
      setItems([])
    }
  }, [])

  async function handlePush() {
    if (!items?.length) return
    setStatus('pushing')
    try {
      const res = await fetch('/api/import-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Server error')
      setResult({ added: data.added, recovered: data.recovered })
      setStatus('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
      setStatus('error')
    }
  }

  return (
    <main className="px-4 pt-10 pb-10 max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-2 text-white">Move Items to Cloud</h1>
      <p className="text-sm text-gray-400 mb-8 leading-relaxed">
        This reads items saved on <em>this browser</em> and pushes them to your
        cloud account so they appear on all devices.
      </p>

      {items === null && (
        <p className="text-sm text-gray-500">Checking…</p>
      )}

      {items !== null && items.length === 0 && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <p className="text-sm text-gray-300 font-semibold mb-1">No items found here.</p>
          <p className="text-xs text-gray-500 leading-relaxed">
            Make sure you&apos;re opening this page from the same browser and device
            where you originally added items, at the original URL (stagr.eosin.vercel.app).
          </p>
        </div>
      )}

      {items !== null && items.length > 0 && (
        <div className="space-y-4">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
            <p className="text-sm font-semibold text-white mb-3">
              {items.length} item{items.length !== 1 ? 's' : ''} found on this device
            </p>
            <ul className="space-y-1.5">
              {items.map(item => (
                <li key={item.id} className="flex items-center justify-between">
                  <span className="text-xs font-mono text-gray-300">{item.sku || item.id}</span>
                  <span className="text-xs text-gray-500">
                    {item.photos?.length ?? 0} photo{(item.photos?.length ?? 0) !== 1 ? 's' : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {status === 'done' && result && (
            <div className="bg-green-950/40 border border-green-500/30 rounded-xl p-4">
              <p className="text-sm font-semibold text-green-400 mb-1">✓ Done!</p>
              <p className="text-xs text-green-300">
                {result.added > 0 && `${result.added} item${result.added !== 1 ? 's' : ''} added. `}
                {result.recovered > 0 && `${result.recovered} item${result.recovered !== 1 ? 's' : ''} had photos recovered. `}
                {result.added === 0 && result.recovered === 0 && 'Everything was already up to date.'}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                You can now open stagr.timothyhales.com — your items will be there.
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-4">
              <p className="text-sm text-red-400">Failed: {errorMsg}</p>
            </div>
          )}

          {status !== 'done' && (
            <button
              onClick={handlePush}
              disabled={status === 'pushing'}
              className="w-full h-[52px] bg-amber-500 text-black font-bold text-sm rounded-xl disabled:opacity-50 active:opacity-80 transition-opacity"
            >
              {status === 'pushing' ? 'Pushing to cloud…' : 'Push Items to Cloud'}
            </button>
          )}
        </div>
      )}
    </main>
  )
}
