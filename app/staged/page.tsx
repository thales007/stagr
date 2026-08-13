'use client'

import { useState } from 'react'
import { useItems } from '@/hooks/useItems'
import ItemCard from '@/components/ItemCard'

export default function StagedPage() {
  const { items, clearAll, deleteItem, refresh } = useItems()
  const [filter, setFilter] = useState('')
  const [clearing, setClearing] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  async function handleRefresh() {
    setRefreshing(true)
    refresh()
    await new Promise(r => setTimeout(r, 800))
    setRefreshing(false)
  }

  async function handleClearAll() {
    if (!window.confirm(`Delete all ${items.length} staged item${items.length !== 1 ? 's' : ''} and their photos? This cannot be undone.`)) return
    setClearing(true)
    await clearAll()
    setClearing(false)
  }

  const sorted = [...items].sort(
    (a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
  )
  const q = filter.trim().toLowerCase()
  const filtered = q
    ? sorted.filter(i =>
        i.sku.toLowerCase().includes(q) ||
        (i.sheetTitle || '').toLowerCase().includes(q)
      )
    : sorted

  return (
    <main className="px-4 pt-6 pb-24">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Staged</h1>
          <p className="text-sm text-gray-500">Ready to list on eBay</p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-gray-500 p-1 disabled:opacity-40"
            aria-label="Refresh"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={refreshing ? 'animate-spin' : ''}>
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Count + clear all */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Items</span>
          <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
            {q ? `${filtered.length}/${items.length}` : items.length}
          </span>
        </div>
        {items.length > 0 && (
          <button
            onClick={handleClearAll}
            disabled={clearing}
            className="text-xs text-red-400/70 active:opacity-60 disabled:opacity-40"
          >
            {clearing ? 'Clearing...' : 'Clear All'}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-600 py-4">No staged items yet. Select something from To Be Listed or tap +.</p>
      ) : (
        <>
          <input
            type="text"
            placeholder="Filter by SKU or name..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white text-base px-4 h-[44px] rounded-lg focus:outline-none focus:border-amber-500 placeholder:text-gray-600 mb-3"
          />
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-600 py-4">No items match &ldquo;{filter}&rdquo;.</p>
          ) : (
            filtered.map(item => <ItemCard key={item.id} item={item} onDelete={deleteItem} />)
          )}
        </>
      )}
    </main>
  )
}
