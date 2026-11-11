import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/layout/Providers'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: {
    default: 'MentorOS — Human Wisdom Intelligence Platform',
    template: '%s | MentorOS',
  },
  description:
    'Extract, explore, and apply wisdom from the world\'s greatest masters. Bruce Lee\'s principles, made actionable for business, leadership, and life.',
  keywords: ['Bruce Lee', 'wisdom', 'AI', 'philosophy', 'martial arts', 'leadership', 'business'],
  authors: [{ name: 'MentorOS' }],
  openGraph: {
    type: 'website',
    siteName: 'MentorOS',
    title: 'MentorOS — Human Wisdom Intelligence Platform',
    description: 'Video → Action → Intent → Principle → Wisdom',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground`}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
