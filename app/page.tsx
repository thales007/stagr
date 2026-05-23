'use client'

import { useItems } from '@/hooks/useItems'
import ItemCard from '@/components/ItemCard'

export default function QueuePage() {
  const { items } = useItems()

  const preppedItems = items.filter(item => item.status === 'prepped')
  const draftedItems = items.filter(item => item.status === 'drafted')

  return (
    <main className="px-4 pt-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Stagr</h1>
        <p className="text-sm text-gray-500">Your staging queue</p>
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
