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
  metadataBase: new URL('https://gunma-odekakemap.jp'),
  title: 'GUNMAP / グンマップ',
  description: '今週末、家族でどこいく？県民がつくる、群馬のおでかけプラットフォーム',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'GUNMAP / グンマップ',
    statusBarStyle: 'default',
  },
  openGraph: {
    images: [
      {
        url: '/ogp.png',
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/ogp.png'],
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
