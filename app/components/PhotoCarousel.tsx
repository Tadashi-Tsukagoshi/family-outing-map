'use client'

import { useRef, useState, useEffect } from 'react'
import PinchZoomImage from './PinchZoomImage'

type Props = {
  images: string[]
  captions?: (string | null | undefined)[]
  height?: number
  radius?: string
  onPhotoClick: (index: number) => void
  mobile?: boolean
}

export default function PhotoCarousel({ images, captions, height, radius, onPhotoClick, mobile = false }: Props) {
  const [index, setIndex] = useState(0)
  const [autoHeight, setAutoHeight] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIndex(0)
    setAutoHeight(null)
    scrollRef.current?.scrollTo({ left: 0 })
  }, [images])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el || el.clientWidth === 0) return
    setIndex(Math.round(el.scrollLeft / el.clientWidth))
  }

  const onFirstImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (height !== undefined || autoHeight !== null) return
    const { naturalWidth, naturalHeight } = e.currentTarget
    const containerW = containerRef.current?.clientWidth
    if (!naturalWidth || !naturalHeight || !containerW) return
    setAutoHeight(containerW * (naturalHeight / naturalWidth))
  }

  const rowHeight = height ?? autoHeight ?? undefined

  return (
    <div ref={containerRef}>
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
            height: rowHeight,
            ...(radius ? { borderRadius: radius } : {}),
          }}
        >
          {images.map((src, i) => {
            const imgStyle: React.CSSProperties = {
              flex: '0 0 100%',
              width: '100%',
              height: rowHeight,
              objectFit: mobile ? (i === 0 ? 'cover' : 'contain') : undefined,
              scrollSnapAlign: 'start',
              cursor: 'pointer',
            }
            return mobile ? (
              <PinchZoomImage
                key={i}
                src={src}
                className="bg-gray-100"
                style={imgStyle}
                onLoad={i === 0 ? onFirstImageLoad : undefined}
              />
            ) : (
              <img
                key={i}
                src={src}
                alt=""
                onClick={() => onPhotoClick(i)}
                onLoad={i === 0 ? onFirstImageLoad : undefined}
                className="bg-gray-100"
                style={imgStyle}
              />
            )
          })}
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

      {captions?.[index] && captions[index]!.trim() !== '' && (
        <p style={{
          fontSize: 12, color: '#4b5563', padding: '1.5px 8px 1.5px 16px', lineHeight: 1.5, margin: 0,
          textAlign: 'center',
        }}>
          {captions[index]}
        </p>
      )}
    </div>
  )
}
