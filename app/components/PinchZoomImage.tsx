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
const ZOOM_THRESHOLD = 1.05
const TAP_THRESHOLD = 10

function distance(a: Touch, b: Touch): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

export default function PinchZoomImage({ src, alt = '', className, style, onError, onLoad }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  // ピンチ用
  const startDistance = useRef(0)
  const startCenter = useRef({ x: 0, y: 0 })
  const baseScale = useRef(1)
  const baseTranslate = useRef({ x: 0, y: 0 })

  // 現在の表示状態
  const scale = useRef(1)
  const origin = useRef({ x: 50, y: 50 })
  const translate = useRef({ x: 0, y: 0 })

  // 1本指パン/タップ判定用
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const wasPinching = useRef(false)

  const isZoomed = () => scale.current > ZOOM_THRESHOLD

  const applyTransform = (animate: boolean) => {
    const img = imgRef.current
    if (!img) return
    img.style.transition = animate ? 'transform 0.3s ease' : 'none'
    img.style.transformOrigin = `${origin.current.x}% ${origin.current.y}%`
    img.style.transform = `scale(${scale.current}) translate(${translate.current.x}px, ${translate.current.y}px)`
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const reset = (animate: boolean) => {
      scale.current = 1
      translate.current = { x: 0, y: 0 }
      origin.current = { x: 50, y: 50 }
      applyTransform(animate)
    }

    const startPinch = (e: TouchEvent) => {
      isPanning.current = false
      startDistance.current = distance(e.touches[0], e.touches[1])
      startCenter.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      }
      baseScale.current = scale.current
      baseTranslate.current = { ...translate.current }

      const rect = el.getBoundingClientRect()
      origin.current = {
        x: ((startCenter.current.x - rect.left) / rect.width) * 100,
        y: ((startCenter.current.y - rect.top) / rect.height) * 100,
      }
      applyTransform(false)
    }

    const startPan = (x: number, y: number) => {
      isPanning.current = true
      panStart.current = { x, y }
      baseTranslate.current = { ...translate.current }
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault()
        startPinch(e)
        return
      }
      if (e.touches.length === 1) {
        if (!isZoomed()) return // 通常状態の1本指操作は素通し
        e.preventDefault()
        wasPinching.current = false // 独立した新規ジェスチャーなのでピンチ直後フラグはクリア
        startPan(e.touches[0].clientX, e.touches[0].clientY)
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && startDistance.current > 0) {
        e.preventDefault()
        wasPinching.current = true
        const ratio = distance(e.touches[0], e.touches[1]) / startDistance.current
        scale.current = Math.min(MAX_SCALE, Math.max(1, baseScale.current * ratio))

        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2
        translate.current = {
          x: baseTranslate.current.x + (cx - startCenter.current.x),
          y: baseTranslate.current.y + (cy - startCenter.current.y),
        }
        if (scale.current <= ZOOM_THRESHOLD) {
          translate.current = { x: 0, y: 0 }
        }
        applyTransform(false)
        return
      }

      if (e.touches.length === 1 && isPanning.current) {
        e.preventDefault()
        translate.current = {
          x: baseTranslate.current.x + (e.touches[0].clientX - panStart.current.x) / scale.current,
          y: baseTranslate.current.y + (e.touches[0].clientY - panStart.current.y) / scale.current,
        }
        applyTransform(false)
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      // ピンチ中だった場合
      if (startDistance.current > 0) {
        startDistance.current = 0
        if (e.touches.length === 1) {
          // 1本指が残った場合はそのままパンへ移行（拡大状態は保持）
          startPan(e.touches[0].clientX, e.touches[0].clientY)
        } else if (e.touches.length === 0 && !isZoomed()) {
          reset(true)
        }
        return
      }

      // 1本指パン/タップ中だった場合
      if (isPanning.current) {
        isPanning.current = false
        if (e.touches.length > 0) return // まだ指が残っている場合は継続扱い

        if (wasPinching.current) {
          // 2本指を同時に離した場合の2回目のtouchend。
          // 1回目のtouchendでパン開始位置を記録しただけで実際の移動はないため、
          // タップ判定はスキップして拡大状態を保持する。
          wasPinching.current = false
          return
        }

        const t = e.changedTouches[0]
        const moved = Math.hypot(t.clientX - panStart.current.x, t.clientY - panStart.current.y)
        if (moved < TAP_THRESHOLD) {
          // タップとみなして元に戻す
          reset(true)
        }
        // 移動が大きければパンとみなし、拡大・移動状態を保持
      }
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
          transform: 'scale(1) translate(0px, 0px)',
          transformOrigin: '50% 50%',
          transition: 'none',
        }}
      />
    </div>
  )
}
