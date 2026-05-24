'use client'

import { useRouter } from 'next/navigation'
import { Item } from '@/hooks/useItems'

interface ItemCardProps {
  item: Item
  onDelete: (id: string) => void
}

export default function ItemCard({ item, onDelete }: ItemCardProps) {
  const router = useRouter()

  const formattedDate = new Date(item.dateAdded).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const thumb = item.photos[0]

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!window.confirm(`Delete "${item.sku || item.id}" and all its photos?`)) return
    onDelete(item.id)
  }

  return (
    <div className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg mb-3 flex items-center gap-3 overflow-hidden">
      {/* Thumbnail */}
      <button
        className="flex-1 text-left p-4 flex items-center gap-3 active:opacity-70 transition-opacity"
        onClick={() => router.push(`/item/${item.id}`)}
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb.url} alt="" className="w-16 h-16 object-cover rounded shrink-0" />
        ) : (
          <div className="w-16 h-16 rounded shrink-0 bg-[#2a2a2a] flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="font-bold text-base font-mono">{item.sku || <span className="text-gray-500 font-normal">No SKU</span>}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500">{item.photos.length} photo{item.photos.length !== 1 ? 's' : ''}</span>
            <span className="text-xs text-gray-600">·</span>
            <span className="text-xs text-gray-600">{formattedDate}</span>
          </div>
        </div>

        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {/* Delete button */}
      <button
        onClick={handleDelete}
        className="shrink-0 h-full px-4 py-4 text-gray-600 active:text-red-400 transition-colors border-l border-[#2a2a2a]"
        aria-label="Delete item"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
      </button>
    </div>
  )
}
