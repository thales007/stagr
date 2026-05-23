'use client'

import { useItems } from '@/hooks/useItems'

export default function ListedPage() {
  const { items } = useItems()

  const listedItems = items
    .filter(item => item.status === 'listed')
    .sort((a, b) => {
      if (!a.dateListed || !b.dateListed) return 0
      return new Date(b.dateListed).getTime() - new Date(a.dateListed).getTime()
    })

  return (
    <main className="px-4 pt-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Listed Items</h1>
        <p className="text-sm text-gray-500">
          {listedItems.length} item{listedItems.length !== 1 ? 's' : ''} listed
        </p>
      </div>

      {listedItems.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-gray-500 text-sm leading-relaxed">
            No listed items yet.
            <br />
            Items will appear here after you mark them listed.
          </p>
        </div>
      ) : (
        <div>
          {listedItems.map(item => {
            const dateListed = item.dateListed
              ? new Date(item.dateListed).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : '—'

            return (
              <div
                key={item.id}
                className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 mb-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs text-gray-500 font-mono">{item.sku}</span>
                    <p className="font-bold text-base truncate mt-0.5">{item.name}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs bg-[#2a2a2a] text-gray-400 px-2 py-0.5 rounded">
                        {item.category}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
                      Listed
                    </span>
                    <p className="text-xs text-gray-500 mt-1">{dateListed}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
