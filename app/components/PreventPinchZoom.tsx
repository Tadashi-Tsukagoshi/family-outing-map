'use client'

import { useEffect } from 'react'

export default function PreventPinchZoom() {
  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length < 2) return
      const target = e.target as Element | null
      if (target?.closest('[data-pinch-zoom]')) return
      e.preventDefault()
    }

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      const target = e.target as Element | null
      if (target?.closest('[data-pinch-zoom]')) return
      e.preventDefault()
    }

    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('wheel', onWheel)
    }
  }, [])

  return null
}
