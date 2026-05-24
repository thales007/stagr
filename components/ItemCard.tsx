'use client'

import { useRouter } from 'next/navigation'
import { Item } from '@/hooks/useItems'

interface ItemCardProps {
  item: Item
}

export default function ItemCard({ item }: ItemCardProps) {
  const router = useRouter()

  const formattedDate = new Date(item.dateAdded).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const thumb = item.photos[0]

  return (
    <button
      className="w-full text-left bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 mb-3 flex items-start gap-3 active:opacity-70 transition-opacity"
      onClick={() => router.push(`/item/${item.id}`)}
    >
      <div className="flex-1 min-w-0">
        <div className="mb-1">
          <span className="text-xs text-gray-500 font-mono">{item.sku}</span>
        </div>
        <p className="font-bold text-base leading-snug truncate">{item.name}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs bg-[#2a2a2a] text-gray-400 px-2 py-0.5 rounded">
            {item.category}
          </span>
          <span className="text-xs text-gray-600">{formattedDate}</span>
        </div>
      </div>
      {thumb && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumb.url}
          alt={item.name}
          draggable
          onDragStart={e => e.dataTransfer.setData('text/uri-list', thumb.url)}
          className="w-16 h-16 object-cover rounded shrink-0"
        />
      )}
    </button>
  )
}
