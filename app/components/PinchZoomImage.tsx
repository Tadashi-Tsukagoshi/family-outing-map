'use client'

import { useEffect, useRef } from 'react'

type Props = {
  src: string
  alt?: string
  className?: string
  style?: React.CSSProperties
  onError?: React.ImgHTMLAttributes<HTMLImageElement>['onError']
  onLoad?: React.ReactEventHandler<HTMLImageElement>
}

const MAX_SCALE = 3

function distance(a: Touch, b: Touch): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

export default function PinchZoomImage({ src, alt = '', className, style, onError, onLoad }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const startDistance = useRef(0)
  const scale = useRef(1)
  const origin = useRef({ x: 50, y: 50 })

  const applyTransform = (animate: boolean) => {
    const img = imgRef.current
    if (!img) return
    img.style.transition = animate ? 'transform 0.3s ease' : 'none'
    img.style.transformOrigin = `${origin.current.x}% ${origin.current.y}%`
    img.style.transform = `scale(${scale.current})`
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return
      e.preventDefault()
      startDistance.current = distance(e.touches[0], e.touches[1])

      const rect = el.getBoundingClientRect()
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2
      origin.current = {
        x: ((cx - rect.left) / rect.width) * 100,
        y: ((cy - rect.top) / rect.height) * 100,
      }
      applyTransform(false)
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || startDistance.current === 0) return
      e.preventDefault()
      const ratio = distance(e.touches[0], e.touches[1]) / startDistance.current
      scale.current = Math.min(MAX_SCALE, Math.max(1, ratio))
      applyTransform(false)
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length >= 2) return
      startDistance.current = 0
      scale.current = 1
      applyTransform(true)
    }

    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: false })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  const { objectFit, cursor, ...wrapperStyle } = style ?? {}

  return (
    <div ref={containerRef} style={{ overflow: 'hidden', ...wrapperStyle }}>
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        onError={onError}
        onLoad={onLoad}
        className={className}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          objectFit,
          cursor,
          transform: 'scale(1)',
          transformOrigin: '50% 50%',
          transition: 'none',
        }}
      />
    </div>
  )
}
