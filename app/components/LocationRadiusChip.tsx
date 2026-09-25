'use client'
import { useCallback, useMemo, useState } from 'react'
import LocationRadiusPopover, { type LocationOption } from './LocationRadiusPopover'

type Props = {
  hasLocation: boolean
  locationRadius: number
  onSelectOff: () => void
  onSelectRadius: (radius: number) => void
}

/** ピル幅の基準となる最長想定ラベル。実際に描画されず、幅の確保のみに使う */
const WIDEST_LABEL = '現在地オフ'

const RADIUS_OPTIONS = [10, 20, 30, 40, 50]

export default function LocationRadiusChip({ hasLocation, locationRadius, onSelectOff, onSelectRadius }: Props) {
  // ポップオーバーのアンカー。render中にref.currentを読まないようstateで保持する
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)
  const [open, setOpen] = useState(false)

  const currentValue: 'off' | number = hasLocation ? locationRadius : 'off'
  const currentLabel = useMemo(() => {
    if (!hasLocation) return '現在地オフ'
    return `半径${locationRadius}km`
  }, [hasLocation, locationRadius])

  const isActive = hasLocation
  const backgroundImage = isActive
    ? 'linear-gradient(to right, #2f50c7, #5fb48c)'
    : 'none'
  const backgroundColor = isActive
    ? 'transparent'
    : 'rgba(255,255,255,0.92)'
  const color = isActive ? 'white' : '#4b5563'

  const handleToggle = useCallback(() => {
    setOpen((prev) => !prev)
  }, [])

  const handleSelect = useCallback((option: LocationOption) => {
    if (option.kind === 'off') {
      onSelectOff()
    } else {
      onSelectRadius(option.value)
    }
    setOpen(false)
  }, [onSelectOff, onSelectRadius])

  const handleClose = useCallback(() => {
    setOpen(false)
  }, [])

  return (
    <>
      <button
        ref={setAnchorEl}
        type="button"
        onClick={handleToggle}
        className="relative md:hidden inline-flex items-center justify-center whitespace-nowrap rounded-full py-1.5 text-sm font-medium cursor-pointer"
        style={{
          paddingLeft: 12,
          paddingRight: 12,
          backgroundImage,
          backgroundColor,
          backgroundClip: 'padding-box',
          WebkitBackgroundClip: 'padding-box',
          color,
          boxShadow: '0 2px 6px rgba(0,0,0,0.25), 0 8px 20px rgba(0,0,0,0.15)',
        }}
        aria-label="現在地・距離円"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {/* 幅確保用のダミー */}
        <span className="invisible inline-flex items-center gap-1" aria-hidden="true">
          <span>{WIDEST_LABEL}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>

        {/* 実表示 */}
        <span
          className="pointer-events-none absolute top-0 bottom-0 flex items-center justify-center gap-1"
          style={{ left: 6, right: 0 }}
        >
          <span>{currentLabel}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {open && (
        <LocationRadiusPopover
          radiusOptions={RADIUS_OPTIONS}
          currentValue={currentValue}
          anchorEl={anchorEl}
          onSelect={handleSelect}
          onClose={handleClose}
        />
      )}
    </>
  )
}
