'use client'

import { useRef, useState, useEffect } from 'react'

type Props = {
  images: string[]
  height: number
  radius?: string
  onPhotoClick: (index: number) => void
}

export default function PhotoCarousel({ images, height, radius, onPhotoClick }: Props) {
  const [index, setIndex] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIndex(0)
    scrollRef.current?.scrollTo({ left: 0 })
  }, [images])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el || el.clientWidth === 0) return
    setIndex(Math.round(el.scrollLeft / el.clientWidth))
  }

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="hide-scrollbar"
        style={{
          display: 'flex',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          height,
          ...(radius ? { borderRadius: radius } : {}),
        }}
      >
        {images.map((src, i) => (
          <img
            key={i}
            src={src}
            alt=""
            onClick={() => onPhotoClick(i)}
            style={{
              flex: '0 0 100%',
              width: '100%',
              height,
              objectFit: 'cover',
              scrollSnapAlign: 'start',
              cursor: 'pointer',
            }}
          />
        ))}
      </div>

      {images.length > 1 && (
        <div
          style={{
            position: 'absolute', bottom: 8, left: 0, right: 0,
            display: 'flex', justifyContent: 'center', gap: 6,
            pointerEvents: 'none',
          }}
        >
          {images.map((_, i) => (
            <span
              key={i}
              style={{
                width: 6, height: 6, borderRadius: '50%',
                background: i === index ? 'white' : 'rgba(255,255,255,0.55)',
                boxShadow: '0 0 2px rgba(0,0,0,0.5)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
