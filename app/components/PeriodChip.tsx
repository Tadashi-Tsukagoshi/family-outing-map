'use client'

import type { PeriodFilter, PeriodOption } from '@/lib/spots'

type Props = {
  periodFilter: PeriodFilter
  onPeriodChange: (p: PeriodFilter) => void
  periodOptions: PeriodOption[]
}

/** ピル幅の基準となる最長想定ラベル。実際に描画されず、幅の確保のみに使う */
const WIDEST_LABEL = "終了'99"

export default function PeriodChip({ periodFilter, onPeriodChange, periodOptions }: Props) {
  const currentLabel = periodOptions.find((opt) => opt.value === periodFilter)?.label ?? ''

  return (
    <div
      className="relative md:hidden inline-flex items-center justify-center whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium"
      style={{
        background: 'rgba(255,255,255,0.92)',
        borderColor: '#e5e7eb',
        color: '#4b5563',
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
        value={periodFilter}
        onChange={(e) => onPeriodChange(e.target.value as PeriodFilter)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none"
        aria-label="表示期間"
      >
        {periodOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}
