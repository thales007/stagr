'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function BottomNav() {
  const pathname = usePathname()
  const active = (path: string) => pathname === path

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-[#1a1a1a] border-t border-[#2a2a2a] flex items-center z-50">

      {/* To Be Listed */}
      <Link
        href="/"
        className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 min-h-[56px] ${active('/') ? 'text-blue-400' : 'text-gray-500'}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
        <span className="text-xs">To List</span>
      </Link>

      {/* Add Item */}
      <Link
        href="/add"
        className="flex-1 flex flex-col items-center justify-center py-2 gap-1 min-h-[56px]"
      >
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${active('/add') ? 'bg-amber-500' : 'bg-amber-600'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </div>
      </Link>

      {/* Staged */}
      <Link
        href="/staged"
        className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 min-h-[56px] ${active('/staged') ? 'text-amber-500' : 'text-gray-500'}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
        <span className="text-xs">Staged</span>
      </Link>

    </nav>
  )
}
