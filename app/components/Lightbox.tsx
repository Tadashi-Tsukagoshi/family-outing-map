'use client'

import { useEffect, useRef } from 'react'

type Props = {
  images: string[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
}

const MAX_SCALE = 5
const DRAG_THRESHOLD = 5

export default function Lightbox({ images, index, onIndexChange, onClose }: Props) {
  const hasMultiple = images.length > 1
  const startX = useRef(0)
  const startY = useRef(0)
  const swiped = useRef(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  // ズーム/パン用
  const scale = useRef(1)
  const translate = useRef({ x: 0, y: 0 })
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const baseTranslate = useRef({ x: 0, y: 0 })
  const dragMoved = useRef(false)

  const goPrev = () => onIndexChange((index - 1 + images.length) % images.length)
  const goNext = () => onIndexChange((index + 1) % images.length)

  const applyTransform = (animate: boolean) => {
    const img = imgRef.current
    const container = containerRef.current
    if (!img || !container) return
    img.style.transition = animate ? 'transform 0.2s ease' : 'none'
    img.style.transform = `scale(${scale.current}) translate(${translate.current.x}px, ${translate.current.y}px)`
    container.style.cursor = scale.current > 1 ? (isDragging.current ? 'grabbing' : 'grab') : 'pointer'
  }

  // 表示画像が変わったらズーム状態をリセット
  useEffect(() => {
    scale.current = 1
    translate.current = { x: 0, y: 0 }
    applyTransform(false)
  }, [index])

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

  // トラックパッドピンチ / Ctrl+スクロールでズーム
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      scale.current = Math.min(MAX_SCALE, Math.max(1, scale.current - e.deltaY * 0.01))
      if (scale.current <= 1) {
        translate.current = { x: 0, y: 0 }
      }
      applyTransform(false)
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // ズーム中のドラッグでパン
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const dx = e.clientX - dragStart.current.x
      const dy = e.clientY - dragStart.current.y
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD) dragMoved.current = true
      translate.current = {
        x: baseTranslate.current.x + dx / scale.current,
        y: baseTranslate.current.y + dy / scale.current,
      }
      applyTransform(false)
    }
    const onMouseUp = () => {
      if (!isDragging.current) return
      isDragging.current = false
      applyTransform(false)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

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

  const onImageMouseDown = (e: React.MouseEvent) => {
    if (scale.current <= 1) return
    isDragging.current = true
    dragMoved.current = false
    dragStart.current = { x: e.clientX, y: e.clientY }
    baseTranslate.current = { ...translate.current }
    applyTransform(false)
  }

  const onImageClick = (e: React.MouseEvent) => {
    if (scale.current > 1 || dragMoved.current) {
      e.stopPropagation()
    }
    dragMoved.current = false
  }

  const onImageDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (scale.current > 1) {
      scale.current = 1
      translate.current = { x: 0, y: 0 }
    } else {
      scale.current = 2
    }
    applyTransform(true)
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

      <div
        ref={containerRef}
        data-pinch-zoom
        onClick={onImageClick}
        onMouseDown={onImageMouseDown}
        onDoubleClick={onImageDoubleClick}
        style={{
          overflow: 'hidden',
          display: 'inline-block',
          lineHeight: 0,
          cursor: 'pointer',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      >
        <img
          ref={imgRef}
          src={images[index]}
          alt=""
          style={{
            maxWidth: '90vw',
            maxHeight: '90vh',
            objectFit: 'contain',
            pointerEvents: 'none',
            transformOrigin: 'center center',
            transform: 'scale(1) translate(0px, 0px)',
            transition: 'none',
          }}
        />
      </div>

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
