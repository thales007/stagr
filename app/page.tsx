'use client'

import Link from 'next/link'
import { useItems } from '@/hooks/useItems'
import ItemCard from '@/components/ItemCard'

export default function QueuePage() {
  const { items } = useItems()

  const preppedItems = items.filter(item => item.status === 'prepped')
  const draftedItems = items.filter(item => item.status === 'drafted')

  return (
    <main className="px-4 pt-6">
      <div className="flex items-start justify-between mb-6">
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
