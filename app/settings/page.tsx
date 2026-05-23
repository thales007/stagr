'use client'

import { useRouter } from 'next/navigation'
import { useSettings } from '@/hooks/useSettings'

const CATEGORIES = [
  'Clothing', 'Shoes', 'Electronics', 'Books', 'Toys',
  'Home & Garden', 'Sports', 'Collectibles', 'Other',
]

export default function SettingsPage() {
  const router = useRouter()
  const { settings, updateSettings, loaded } = useSettings()

  if (!loaded) return null

  return (
    <main className="px-4 pt-6 pb-6">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => router.back()} className="text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-xl font-bold">Settings</h1>
      </div>

      <div className="space-y-6">
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Add Item Defaults</h2>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-4">
              <div>
                <p className="text-sm font-medium">Default Category</p>
                <p className="text-xs text-gray-500 mt-0.5">Pre-selected when adding a new item</p>
              </div>
              <div className="relative">
                <select
                  value={settings.defaultCategory}
                  onChange={e => updateSettings({ defaultCategory: e.target.value })}
                  className="bg-[#2a2a2a] text-white text-sm border border-[#3a3a3a] rounded-lg px-3 py-2 pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">About</h2>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-4 space-y-1">
            <p className="text-sm font-medium">Stagr</p>
            <p className="text-xs text-gray-500">Version 1.0</p>
            <p className="text-xs text-gray-500">stagr.timothyhales.com</p>
          </div>
        </section>
      </div>
    </main>
  )
}
