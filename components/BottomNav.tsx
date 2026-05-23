'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function BottomNav() {
  const pathname = usePathname()
  const active = (path: string) => pathname === path

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-[#1a1a1a] border-t border-[#2a2a2a] flex items-center z-50">
      {/* Queue */}
      <Link
        href="/"
        className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 min-h-[56px] ${active('/') ? 'text-amber-500' : 'text-gray-500'}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
        <span className="text-xs">Queue</span>
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

      {/* Listed */}
      <Link
        href="/listed"
        className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 min-h-[56px] ${active('/listed') ? 'text-amber-500' : 'text-gray-500'}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 11 12 14 22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
        <span className="text-xs">Listed</span>
      </Link>
    </nav>
  )
}
