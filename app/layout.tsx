import type { Metadata } from 'next'
import { Noto_Sans_JP, Shippori_Mincho } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const notoSansJP = Noto_Sans_JP({
  variable: '--font-noto-sans-jp',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  preload: false,
})

const shipporiMincho = Shippori_Mincho({
  variable: '--font-shippori-mincho',
  subsets: ['latin'],
  weight: ['400', '700'],
  preload: false,
  display: 'swap',
})

export const metadata: Metadata = {
  title: '群馬県おでかけまっぷ',
  description: '今週末、子どもとどこ行く？\n家族で楽しめるイベントを地図で発見！',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: '群馬県おでかけまっぷ',
    statusBarStyle: 'default',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja" className={`${notoSansJP.variable} ${shipporiMincho.variable} h-full`}>
      <body className="h-full">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
