import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/BottomNav'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Stagr',
  description: 'Your reseller staging queue',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className={`${inter.className} bg-[#0f0f0f] text-white min-h-screen`}>
        <div className="max-w-[480px] mx-auto relative min-h-screen pb-20">
          {children}
          <BottomNav />
        </div>
      </body>
    </html>
  )
}
