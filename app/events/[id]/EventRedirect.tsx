'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function EventRedirect({ eventId }: { eventId: string }) {
  const router = useRouter()

  useEffect(() => {
    router.replace(`/?event=${eventId}`)
  }, [eventId, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-sm text-gray-500">読み込み中...</p>
    </div>
  )
}
