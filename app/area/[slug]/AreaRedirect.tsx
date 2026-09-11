'use client'

import { useLayoutEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AreaRedirect({ slug }: { slug: string }) {
  const router = useRouter()

  // ブラウザがSSR本文をペイントする前にリダイレクトを開始するため useEffect ではなく useLayoutEffect を使う
  // （本文自体はCSSで視覚的に非表示にしているため必須ではないが、ページ遷移をできるだけ早く開始する）
  useLayoutEffect(() => {
    router.replace(`/?area=${slug}`)
  }, [slug, router])

  return null
}
