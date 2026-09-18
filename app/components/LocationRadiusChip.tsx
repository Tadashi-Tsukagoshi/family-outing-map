'use client'
import { useMemo } from 'react'

type Props = {
  hasLocation: boolean
  locationRadius: number
  onSelectOff: () => void
  onSelectRadius: (radius: number) => void
}

/** ピル幅の基準となる最長想定ラベル。実際に描画されず、幅の確保のみに使う */
const WIDEST_LABEL = '現在地オフ'

const RADIUS_OPTIONS = [10, 20, 30, 40, 50]

// select の value: 'off' or '10' | '20' | ...
type SelectValue = 'off' | '10' | '20' | '30' | '40' | '50'

export default function LocationRadiusChip({ hasLocation, locationRadius, onSelectOff, onSelectRadius }: Props) {
  const currentValue: SelectValue = hasLocation ? String(locationRadius) as SelectValue : 'off'
  const currentLabel = useMemo(() => {
    if (!hasLocation) return '現在地オフ'
    return `半径${locationRadius}km`
  }, [hasLocation, locationRadius])

  const isActive = hasLocation  // グラデーション白抜きにするか
  // background ショートハンドではなく backgroundImage / backgroundColor に
  // 分解することで、backgroundClip との競合警告を回避
  const backgroundImage = isActive
    ? 'linear-gradient(to right, #2f50c7, #5fb48c)'
    : 'none'
  const backgroundColor = isActive
    ? 'transparent'
    : 'rgba(255,255,255,0.92)'
  const color = isActive ? 'white' : '#4b5563'
  const borderColor = isActive ? 'transparent' : '#e5e7eb'

  const handleChange = (value: string) => {
    if (value === 'off') {
      onSelectOff()
    } else {
      onSelectRadius(Number(value))
    }
  }

  return (
    <div
      className="relative md:hidden inline-flex items-center justify-center whitespace-nowrap rounded-full border py-1.5 text-sm font-medium"
      style={{
        paddingLeft: 12,
        paddingRight: 12,
        backgroundImage,
        backgroundColor,
        // 角丸ピル形状のため、境界線の内側にだけ背景を描画してborder-radiusの丸みと
        // 背景の描画範囲を一致させる（AreaChipsと同じ対応）
        backgroundClip: 'padding-box',
        WebkitBackgroundClip: 'padding-box',
        borderColor,
        color,
        boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
      }}
    >
      {/* 幅確保用のダミー（非表示だがレイアウト上のスペースは確保） */}
      <span className="invisible inline-flex items-center gap-1" aria-hidden="true">
        <span>{WIDEST_LABEL}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </span>

      {/* 実表示（絶対配置＋leftオフセットで視覚的中央に配置） */}
      <span
        className="pointer-events-none absolute top-0 bottom-0 flex items-center justify-center gap-1"
        style={{ left: 6, right: 0 }}
      >
        <span>{currentLabel}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </span>

      {/* 透明<select>を重ねてタップ領域と機能を担当 */}
      <select
        value={currentValue}
        onChange={(e) => handleChange(e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none"
        aria-label="現在地・距離円"
      >
        <option value="off">現在地オフ</option>
        {RADIUS_OPTIONS.map((r) => (
          <option key={r} value={String(r)}>半径{r}km</option>
        ))}
      </select>
    </div>
  )
}
