import type { Metadata, Viewport } from 'next'
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
  metadataBase: new URL('https://gunma-odekakemap.jp'),
  title: 'GUNMAp｜グンマップ',
  description: '群馬県のイベントを地図から発見するWebアプリ「GUNMAp｜グンマップ」',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'GUNMAp｜グンマップ',
    statusBarStyle: 'default',
  },
  openGraph: {
    images: [
      {
        url: '/gunmap_OGP_05.png',
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/gunmap_OGP_05.png'],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
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
