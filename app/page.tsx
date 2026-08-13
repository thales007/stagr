'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useItems } from '@/hooks/useItems'
import ItemCard from '@/components/ItemCard'

interface SheetItem {
  row: number
  item: string
  cost: number
  datePurchased: string
}

export default function QueuePage() {
  const router = useRouter()
  const { items, clearAll, deleteItem, refresh } = useItems()
  const [clearing, setClearing] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState('')

  // To Be Listed — loaded from sheet on mount
  const [sheetItems, setSheetItems] = useState<SheetItem[]>([])
  const [sheetLoading, setSheetLoading] = useState(true)
  const [sheetError, setSheetError] = useState('')
  const [sheetFilter, setSheetFilter] = useState('')

  useEffect(() => {
    fetch('/api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'searchUnlisted', query: '' }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) setSheetError(data.error)
        else setSheetItems(data.results || [])
      })
      .catch(() => setSheetError('Could not reach inventory sheet.'))
      .finally(() => setSheetLoading(false))
  }, [])

  function startAdd(item: SheetItem) {
    const params = new URLSearchParams({
      sheetRow: String(item.row),
      sheetTitle: item.item,
      sheetCost: String(item.cost),
    })
    router.push(`/add?${params}`)
  }

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

  // Sort staged items newest first, apply filter
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

  // Filter sheet items client-side
  const sq = sheetFilter.trim().toLowerCase()
  const sheetFiltered = sq
    ? sheetItems.filter(i => i.item.toLowerCase().includes(sq))
    : sheetItems

  return (
    <main className="px-4 pt-6 pb-24">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Stagr</h1>
          <p className="text-sm text-gray-500">Your staging queue</p>
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
          <Link href="/settings" className="text-gray-500 p-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Link>
        </div>
      </div>

      {/* To Be Listed — sheet inventory */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">To Be Listed</h2>
          {!sheetLoading && !sheetError && (
            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
              {sq ? `${sheetFiltered.length}/${sheetItems.length}` : sheetItems.length}
            </span>
          )}
        </div>

        {sheetLoading ? (
          <div className="flex items-center gap-2 py-4 text-gray-600 text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Loading inventory...
          </div>
        ) : sheetError ? (
          <p className="text-sm text-gray-600 py-2">{sheetError}</p>
        ) : sheetItems.length === 0 ? (
          <p className="text-sm text-gray-600 py-2">All items listed — nothing left in inventory.</p>
        ) : (
          <>
            <input
              type="text"
              placeholder="Filter by brand or name..."
              value={sheetFilter}
              onChange={e => setSheetFilter(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white text-sm px-4 h-[44px] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-600 mb-3"
            />
            {sheetFiltered.length === 0 ? (
              <p className="text-sm text-gray-600 py-2">No results for &ldquo;{sheetFilter}&rdquo;.</p>
            ) : (
              <div className="space-y-2">
                {sheetFiltered.map(item => (
                  <button
                    key={item.row}
                    type="button"
                    onClick={() => startAdd(item)}
                    className="w-full text-left bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 active:border-blue-500/50 transition-colors"
                  >
                    <p className="text-sm font-medium text-white">{item.item}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Cost: ${item.cost.toFixed(2)} · {item.datePurchased}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* Staged queue */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Staged</h2>
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
          <p className="text-sm text-gray-600 py-2">No staged items. Tap + or select from inventory above.</p>
        ) : (
          <>
            {items.length > 0 && (
              <input
                type="text"
                placeholder="Filter by SKU or name..."
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white text-sm px-4 h-[44px] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-gray-600 mb-3"
              />
            )}
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-600 py-2">No items match &ldquo;{filter}&rdquo;.</p>
            ) : (
              filtered.map(item => <ItemCard key={item.id} item={item} onDelete={deleteItem} />)
            )}
          </>
        )}
      </section>
    </main>
  )
}
