'use client'

import { useEffect, useRef } from 'react'

type Props = {
  images: string[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
}

export default function Lightbox({ images, index, onIndexChange, onClose }: Props) {
  const hasMultiple = images.length > 1
  const startX = useRef(0)
  const startY = useRef(0)
  const swiped = useRef(false)

  const goPrev = () => onIndexChange((index - 1 + images.length) % images.length)
  const goNext = () => onIndexChange((index + 1) % images.length)

  useEffect(() => {
    if (!hasMultiple) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  goPrev()
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'Escape')     onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [hasMultiple, index, images.length])

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    swiped.current = false
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!hasMultiple) return
    const dx = e.changedTouches[0].clientX - startX.current
    const dy = e.changedTouches[0].clientY - startY.current
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      swiped.current = true
      if (dx > 0) goPrev()
      else        goNext()
    }
  }
  const handleOverlayClick = () => {
    if (swiped.current) {
      swiped.current = false
      return
    }
    onClose()
  }

  return (
    <div
      onClick={handleOverlayClick}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      <button
        onClick={onClose}
        aria-label="閉じる"
        style={{
          position: 'absolute', top: 16, right: 16,
          width: 36, height: 36, borderRadius: '50%',
          background: 'white', color: '#111',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, lineHeight: 1,
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
          zIndex: 1,
        }}
      >
        ×
      </button>

      {hasMultiple && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); goPrev() }}
            aria-label="前の写真"
            style={{
              position: 'absolute', top: '50%', left: 16, transform: 'translateY(-50%)',
              width: 40, height: 40, borderRadius: '50%',
              background: 'white', color: '#111',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, lineHeight: 1,
              boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
              zIndex: 1,
            }}
          >
            ‹
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); goNext() }}
            aria-label="次の写真"
            style={{
              position: 'absolute', top: '50%', right: 16, transform: 'translateY(-50%)',
              width: 40, height: 40, borderRadius: '50%',
              background: 'white', color: '#111',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, lineHeight: 1,
              boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
              zIndex: 1,
            }}
          >
            ›
          </button>
        </>
      )}

      <img
        src={images[index]}
        alt=""
        style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }}
      />

      {hasMultiple && (
        <div
          style={{
            position: 'absolute', bottom: 24, left: 0, right: 0,
            display: 'flex', justifyContent: 'center', gap: 8,
            pointerEvents: 'none',
          }}
        >
          {images.map((_, i) => (
            <span
              key={i}
              style={{
                width: 7, height: 7, borderRadius: '50%',
                background: i === index ? 'white' : 'rgba(255,255,255,0.5)',
                boxShadow: '0 0 2px rgba(0,0,0,0.5)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
