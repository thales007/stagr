'use client'

import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const router = useRouter()

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

      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">About</h2>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-4 space-y-1">
          <p className="text-sm font-medium">Stagr</p>
          <p className="text-xs text-gray-500">Version 1.0</p>
          <p className="text-xs text-gray-500">stagr.timothyhales.com</p>
        </div>
      </section>
    </main>
  )
}
