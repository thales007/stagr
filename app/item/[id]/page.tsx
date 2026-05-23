'use client'

import { useRouter } from 'next/navigation'
import { use } from 'react'
import { useItems } from '@/hooks/useItems'

export default function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { items, moveToDrafted, moveToListed } = useItems()

  const item = items.find(i => i.id === id)

  if (!item) {
    return (
      <main className="px-4 pt-6">
        <button onClick={() => router.back()} className="text-gray-400 mb-6 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
        <p className="text-gray-500">Item not found.</p>
      </main>
    )
  }

  const formattedDate = new Date(item.dateAdded).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  function handleMoveToDrafted() {
    moveToDrafted(item!.id)
    router.push('/')
  }

  async function handleMoveToListed() {
    await moveToListed(item!.id)
    router.push('/')
  }

  return (
    <main className="px-4 pt-6 pb-8">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="text-gray-400 mb-5 flex items-center gap-2 min-h-[44px]"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back
      </button>

      {/* Item info */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-gray-500 font-mono">{item.sku}</span>
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              item.status === 'prepped'
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-blue-500/20 text-blue-400'
            }`}
          >
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </span>
        </div>
        <h1 className="text-2xl font-bold">{item.name}</h1>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs bg-[#2a2a2a] text-gray-400 px-2 py-0.5 rounded">
            {item.category}
          </span>
          <span className="text-xs text-gray-500">Added {formattedDate}</span>
        </div>
      </div>

      {/* Photos */}
      {item.photos.length > 0 ? (
        <div className="mb-6">
          <p className="hidden md:block text-xs text-gray-500 mb-3">
            Drag photos directly into your eBay listing
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {item.photos.map(photo => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={photo.publicId}
                src={photo.url}
                alt={item.name}
                draggable
                onDragStart={e => {
                  e.dataTransfer.setData('text/uri-list', photo.url)
                  e.dataTransfer.setData('text/plain', photo.url)
                }}
                className="w-full aspect-square object-cover rounded-lg cursor-grab active:cursor-grabbing"
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-6 py-10 text-center border border-dashed border-[#2a2a2a] rounded-lg">
          <p className="text-sm text-gray-600">No photos on this item.</p>
        </div>
      )}

      {/* Status actions */}
      <div className="space-y-3">
        {item.status === 'prepped' && (
          <button
            onClick={handleMoveToDrafted}
            className="w-full h-[52px] bg-blue-600 text-white font-semibold text-sm rounded-lg active:opacity-80 transition-opacity"
          >
            Move to Drafted
          </button>
        )}
        {item.status === 'drafted' && (
          <button
            onClick={handleMoveToDrafted}
            className="w-full h-[52px] bg-[#1a1a1a] border border-[#2a2a2a] text-gray-400 font-semibold text-sm rounded-lg active:opacity-80 transition-opacity"
            disabled
          >
            Drafted
          </button>
        )}
        <button
          onClick={handleMoveToListed}
          className="w-full h-[56px] bg-red-600 text-white font-bold text-base rounded-lg active:opacity-80 transition-opacity"
        >
          Mark as Listed — Delete Photos
        </button>
        <p className="text-xs text-gray-600 text-center">
          This will permanently delete all photos for this item.
        </p>
      </div>
    </main>
  )
}
