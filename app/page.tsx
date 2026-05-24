'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useItems } from '@/hooks/useItems'
import ItemCard from '@/components/ItemCard'
import { downloadItemsAsZip } from '@/lib/downloadZip'

export default function QueuePage() {
  const { items } = useItems()
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)

  const preppedItems = items.filter(item => item.status === 'prepped')
  const draftedItems = items.filter(item => item.status === 'drafted')
  const activeItems = [...preppedItems, ...draftedItems]
  const itemsWithPhotos = activeItems.filter(i => i.photos.length > 0)
  const totalPhotos = itemsWithPhotos.reduce((sum, i) => sum + i.photos.length, 0)

  async function handleDownloadAll() {
    if (itemsWithPhotos.length === 0) return
    setDownloading(true)
    setProgress({ current: 0, total: totalPhotos })
    try {
      await downloadItemsAsZip(itemsWithPhotos, (current, total) => {
        setProgress({ current, total })
      })
    } finally {
      setDownloading(false)
      setProgress(null)
    }
  }

  return (
    <main className="px-4 pt-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Stagr</h1>
          <p className="text-sm text-gray-500">Your staging queue</p>
        </div>
        <Link href="/settings" className="text-gray-500 p-1 mt-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </Link>
      </div>

      {/* Download All for eBay — only shown when items with photos exist */}
      {itemsWithPhotos.length > 0 && (
        <button
          onClick={handleDownloadAll}
          disabled={downloading}
          className="w-full h-[48px] bg-[#1a1a1a] border border-amber-500/40 rounded-lg flex items-center justify-center gap-2 text-amber-500 text-sm font-medium mb-5 active:opacity-70 disabled:opacity-60 transition-opacity"
        >
          {downloading && progress ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Packaging {progress.current} of {progress.total} photos...
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download All for eBay — {itemsWithPhotos.length} item{itemsWithPhotos.length !== 1 ? 's' : ''}, {totalPhotos} photo{totalPhotos !== 1 ? 's' : ''}
            </>
          )}
        </button>
      )}

      {/* Prepped section */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Prepped</h2>
          <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
            {preppedItems.length}
          </span>
        </div>
        {preppedItems.length === 0 ? (
          <p className="text-sm text-gray-600 py-4">No prepped items. Tap + to add one.</p>
        ) : (
          preppedItems.map(item => <ItemCard key={item.id} item={item} />)
        )}
      </section>

      {/* Drafted section */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Drafted</h2>
          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
            {draftedItems.length}
          </span>
        </div>
        {draftedItems.length === 0 ? (
          <p className="text-sm text-gray-600 py-4">No drafted items. Items you&apos;ve drafted will appear here.</p>
        ) : (
          draftedItems.map(item => <ItemCard key={item.id} item={item} />)
        )}
      </section>
    </main>
  )
}
