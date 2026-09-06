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

    document.addEventListener('touchmove', onTouchMove, { passive: false })

    return () => {
      document.removeEventListener('touchmove', onTouchMove)
    }
  }, [])

  return null
}
