'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useItems } from '@/hooks/useItems'

interface SheetItem {
  row: number
  item: string
  cost: number
  datePurchased: string
}

const CACHE_KEY = 'stagr-sheet-cache'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function loadCache(): SheetItem[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { items, ts } = JSON.parse(raw)
    return Date.now() - ts < CACHE_TTL ? items : null
  } catch { return null }
}

function saveCache(items: SheetItem[]) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ items, ts: Date.now() })) } catch {}
}

export default function ToBeListedPage() {
  const router = useRouter()
  const { items: stagedItems } = useItems()

  const [sheetItems, setSheetItems] = useState<SheetItem[]>(() => loadCache() ?? [])
  const [sheetLoading, setSheetLoading] = useState(true)
  const [sheetError, setSheetError] = useState('')
  const [sheetFilter, setSheetFilter] = useState('')

  useEffect(() => {
    const cached = loadCache()
    if (cached) {
      setSheetItems(cached)
      setSheetLoading(false)
    }

    fetch('/api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'searchUnlisted', query: '' }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setSheetError(data.error)
        } else {
          const results: SheetItem[] = data.results || []
          setSheetItems(results)
          saveCache(results)
          setSheetError('')
        }
      })
      .catch(() => {
        if (!sheetItems.length) setSheetError('Could not reach inventory sheet.')
      })
      .finally(() => setSheetLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function startAdd(item: SheetItem) {
    const params = new URLSearchParams({
      sheetRow: String(item.row),
      sheetTitle: item.item,
      sheetCost: String(item.cost),
    })
    router.push(`/add?${params}`)
  }

  // Filter out rows that are already linked to a staged item
  const stagedRows = new Set(stagedItems.filter(i => i.sheetRow).map(i => i.sheetRow!))
  const available = sheetItems.filter(s => !stagedRows.has(s.row))

  const sq = sheetFilter.trim().toLowerCase()
  const displayed = sq ? available.filter(i => i.item.toLowerCase().includes(sq)) : available

  const isEmpty = !sheetLoading && !sheetError && available.length === 0

  return (
    <main className="px-4 pt-6 pb-24">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Stagr</h1>
          <p className="text-sm text-gray-500">Select an item to photograph</p>
        </div>
        <Link href="/settings" className="text-gray-500 p-1 mt-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </Link>
      </div>

      {/* Count + filter */}
      {!sheetError && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">To Be Listed</span>
          {!sheetLoading && (
            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
              {sq ? `${displayed.length}/${available.length}` : available.length}
            </span>
          )}
          {sheetLoading && sheetItems.length > 0 && (
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          )}
        </div>
      )}

      {/* Loading (no cache) */}
      {sheetLoading && sheetItems.length === 0 && (
        <div className="flex items-center gap-2 py-6 text-gray-600 text-sm">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          Loading inventory...
        </div>
      )}

      {/* Error */}
      {sheetError && (
        <p className="text-sm text-gray-600 py-4">{sheetError}</p>
      )}

      {/* Empty */}
      {isEmpty && (
        <p className="text-sm text-gray-600 py-4">Everything is photographed — nothing left to list.</p>
      )}

      {/* Filter + list */}
      {available.length > 0 && (
        <>
          <input
            type="text"
            placeholder="Filter by brand or name..."
            value={sheetFilter}
            onChange={e => setSheetFilter(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white text-base px-4 h-[44px] rounded-lg focus:outline-none focus:border-blue-500 placeholder:text-gray-600 mb-3"
          />
          {displayed.length === 0 ? (
            <p className="text-sm text-gray-600 py-4">No results for &ldquo;{sheetFilter}&rdquo;.</p>
          ) : (
            <div className="space-y-2">
              {displayed.map(item => (
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
    </main>
  )
}
