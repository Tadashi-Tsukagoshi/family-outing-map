'use client'

import { useRef, useState } from 'react'

type Props = {
  src: string
  alt?: string
  className?: string
  style?: React.CSSProperties
  onError?: React.ImgHTMLAttributes<HTMLImageElement>['onError']
  onLoad?: React.ReactEventHandler<HTMLImageElement>
}

const MAX_SCALE = 3

function distance(a: React.Touch, b: React.Touch): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

export default function PinchZoomImage({ src, alt = '', className, style, onError, onLoad }: Props) {
  const [scale, setScale] = useState(1)
  const [origin, setOrigin] = useState({ x: 50, y: 50 })
  const [animate, setAnimate] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const startDistance = useRef(0)

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 2) return
    e.preventDefault()
    setAnimate(false)
    startDistance.current = distance(e.touches[0], e.touches[1])

    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2
      setOrigin({
        x: ((cx - rect.left) / rect.width) * 100,
        y: ((cy - rect.top) / rect.height) * 100,
      })
    }
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length !== 2 || startDistance.current === 0) return
    e.preventDefault()
    const ratio = distance(e.touches[0], e.touches[1]) / startDistance.current
    setScale(Math.min(MAX_SCALE, Math.max(1, ratio)))
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length >= 2) return
    startDistance.current = 0
    setAnimate(true)
    setScale(1)
  }

  const { objectFit, cursor, ...wrapperStyle } = style ?? {}

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ overflow: 'hidden', ...wrapperStyle }}
    >
      <img
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
          transform: `scale(${scale})`,
          transformOrigin: `${origin.x}% ${origin.y}%`,
          transition: animate ? 'transform 0.3s ease' : 'none',
        }}
      />
    </div>
  )
}
