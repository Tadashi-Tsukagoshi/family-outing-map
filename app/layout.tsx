import type { Metadata } from 'next'
import { Noto_Sans_JP, Shippori_Mincho } from 'next/font/google'
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
  title: '太田市イベントまっぷ',
  description: '群馬県太田市周辺の家族向けおでかけスポット・イベント情報',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja" className={`${notoSansJP.variable} ${shipporiMincho.variable} h-full`}>
      <body className="h-full">{children}</body>
    </html>
  )
}
