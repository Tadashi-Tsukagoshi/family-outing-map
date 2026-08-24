'use client'

import { useRef } from 'react'
import { CATEGORY_LABELS, CATEGORY_BUTTON_LABEL_OVERRIDES, PERIOD_LABELS, getCategoryIconSrc, isDarkPin, type Category, type AllCategory, type PeriodFilter, type Spot } from '@/lib/spots'
import { getDateDisplay, fmtTimeRange } from '@/lib/date-utils'

// モバイル版の現在地スライダー：つまみタップ（動かさない）とドラッグ（動かす）を判別するための閾値
const RADIUS_TAP_MAX_DISTANCE  = 10 // px。これ未満の移動は「タップ」とみなす
const RADIUS_TAP_MAX_DURATION  = 300 // ms。これ未満の押下時間は「タップ」とみなす
const RADIUS_THUMB_TAP_RADIUS  = 17 // px。つまみ中心からこの距離以内で押し始めたら「つまみタップ」候補とする

type Props = {
  periodFilter: PeriodFilter
  onPeriodChange: (p: PeriodFilter) => void
  activeCategories: Set<Category>
  onCategoryToggle: (cat: Category) => void
  spots: Spot[]
  selectedSpot: Spot | null
  onDetailOpen: (spot: Spot) => void
  onDetailClose: () => void
  onSpotSelect?: (spot: Spot | null) => void
  onLocate: () => void
  onLocateClear: () => void
  hasLocation: boolean
  locateStatus: 'idle' | 'loading'
  locationRadius: number
  onRadiusChange: (r: number) => void
  mode?: 'sidebar' | 'sheet'
}

const ICON_RATIO: Record<AllCategory, number> = { event: 1, event_plus: 1, fireworks: 1.6, festival: 0.92, park: 0.92, kumamoto_earthquake_r8: 1 }
const GRADIENT_BORDER_BG: Partial<Record<Category, string>> = { fireworks: '#0a0a3c', festival: '#1e1614' }
const GRADIENT_BORDER = 'conic-gradient(from 0deg, #ffd600 0deg, #ffd600 60deg, #ff8a00 120deg, #ea4335 200deg, #bc2a8d 280deg, #ffd600 360deg)'
const GRADIENT_BORDER_WIDTH = 2.5 * 0.7

export function CategoryIcon({ category, active = true, size = 20 }: { category: AllCategory; active?: boolean; size?: number }) {
  const imgSize = Math.round(size * ICON_RATIO[category])

  if (category === 'fireworks') {
    const inner = size - GRADIENT_BORDER_WIDTH * 2
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size, flexShrink: 0, borderRadius: '50%',
        background: GRADIENT_BORDER,
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: inner, height: inner, margin: GRADIENT_BORDER_WIDTH,
          borderRadius: '50%', backgroundColor: GRADIENT_BORDER_BG[category], overflow: 'hidden',
        }}>
          <img
            src={getCategoryIconSrc(category) ?? undefined}
            alt=""
            style={{ width: imgSize, height: imgSize, objectFit: 'contain', display: 'block', opacity: active ? 1 : 0.35 }}
          />
        </span>
      </span>
    )
  }

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, flexShrink: 0,
    }}>
      <img
        src={getCategoryIconSrc(category) ?? undefined}
        alt=""
        style={{ width: imgSize, height: imgSize, objectFit: 'contain', display: 'block', opacity: active ? 1 : 0.35 }}
      />
    </span>
  )
}

export default function Sidebar({
  periodFilter,
  onPeriodChange,
  activeCategories,
  onCategoryToggle,
  spots,
  selectedSpot,
  onDetailOpen,
  onDetailClose,
  onSpotSelect,
  onLocate,
  onLocateClear,
  hasLocation,
  locateStatus,
  locationRadius,
  onRadiusChange,
  mode = 'sidebar',
}: Props) {
  const isSheet = mode === 'sheet'

  // 現在地スライダー：つまみの中心位置（%）。モバイルはタップ領域拡大のためつまみを大きく描画するので、計算に使う幅もそれに合わせる
  const radiusPercent    = (locationRadius - 10) / 50
  const radiusThumbWidth = isSheet ? 22 : 16
  const radiusThumbLeft  = `calc(${radiusPercent * 100}% + ${radiusThumbWidth / 2 - radiusPercent * radiusThumbWidth}px)`
  // モバイル用トラックの塗り（つまみより左＝現在値まで を色付け）。CSS変数として渡し、globals.css側の
  // ::-webkit-slider-runnable-track / ::-moz-range-track の background で参照する（PC版のトラックには影響しない）
  const radiusTrackFill = hasLocation
    ? `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${radiusPercent * 100}%, #d1d5db ${radiusPercent * 100}%, #d1d5db 100%)`
    : '#e5e7eb'

  // モバイル版のスライダー：つまみタップ＝ON/OFF切り替え、ドラッグ・線上タップ＝距離変更（既存のonChangeに任せる）を両立させる。
  // pointerdown時点のつまみ位置と押下座標から「つまみ付近で押し始めたか」を記録しておき、
  // pointerupで移動量・経過時間が小さければ「タップ」と判定してON/OFFを切り替える。
  // 移動量が閾値を超えた場合は「ドラッグ」とみなし、rangeのonChangeによる距離変更のみが働く（ここでは何もしない）。
  const radiusPointerStart = useRef<{ x: number; y: number; time: number; onThumb: boolean } | null>(null)

  const handleRadiusPointerDown = (e: React.PointerEvent<HTMLInputElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const thumbCenterPx = radiusPercent * rect.width + (radiusThumbWidth / 2 - radiusPercent * radiusThumbWidth)
    const onThumb = Math.abs(e.clientX - rect.left - thumbCenterPx) <= RADIUS_THUMB_TAP_RADIUS
    radiusPointerStart.current = { x: e.clientX, y: e.clientY, time: Date.now(), onThumb }
  }

  const handleRadiusPointerUp = (e: React.PointerEvent<HTMLInputElement>) => {
    const start = radiusPointerStart.current
    radiusPointerStart.current = null
    if (!start || !start.onThumb || locateStatus === 'loading') return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    const elapsed = Date.now() - start.time
    const isTap = Math.sqrt(dx * dx + dy * dy) < RADIUS_TAP_MAX_DISTANCE && elapsed < RADIUS_TAP_MAX_DURATION
    if (isTap) {
      if (hasLocation) onLocateClear()
      else onLocate()
    }
  }

  const handleRadiusPointerCancel = () => {
    radiusPointerStart.current = null
  }

  return (
    <aside className={`bg-white flex flex-col overflow-hidden ${isSheet ? 'w-full' : 'w-80 border-r border-gray-200'}`}>

      {/* タイトル（サイドバーモードのみ） */}
      {!isSheet && (
        <div className="pt-1 pb-4 pr-4 pl-[22px] border-b border-gray-200">
          <img src="/logo-pc_05.png" alt="GUNMAP" className="h-[52px] w-auto -ml-[8px]" />
          <p className="text-xs -mt-1 leading-relaxed ml-[39px]" style={{ color: '#1F1F1F' }}>
            群馬の週末おでかけプラットフォーム
          </p>
        </div>
      )}

      {/* フィルター */}
      <div className={`pl-[22px] border-b border-gray-100 ${isSheet ? 'p-4 space-y-3' : 'py-2.5 pr-4 space-y-2'}`}>
        {/* 表示期間・現在地を表示：同じグリッドの列として並べることで、プルダウンとスライダーの幅・右端を揃える */}
        <div className={`grid grid-cols-[auto_auto] items-center justify-between ${isSheet ? 'gap-y-3' : 'gap-y-2'}`}>
          <span className="text-sm" style={{ color: '#1F1F1F' }}>表示期間</span>
          <select
            value={periodFilter}
            onChange={(e) => onPeriodChange(e.target.value as PeriodFilter)}
            className="justify-self-end text-sm border border-gray-300 rounded-md px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            {(Object.keys(PERIOD_LABELS) as PeriodFilter[]).map((key) => (
              <option key={key} value={key}>{PERIOD_LABELS[key]}</option>
            ))}
          </select>

          <div className="self-start pt-5">
            <span
              className={`-mt-0.5 flex items-center text-sm ${isSheet ? 'h-7' : 'h-5'}`}
              style={{ color: '#1F1F1F' }}
            >
              現在地・距離円
            </span>
          </div>
          <div className="relative w-full self-start pt-5">
            <div className="relative">
              <div
                className={`absolute -top-5 -translate-x-1/2 text-xs ${isSheet ? 'font-semibold' : 'font-normal'} tabular-nums pointer-events-none whitespace-nowrap ${hasLocation ? 'text-blue-600' : 'text-gray-400'}`}
                style={{ left: radiusThumbLeft }}
              >
                半径{locationRadius}km
              </div>
              <input
                type="range"
                min={10}
                max={60}
                step={10}
                value={locationRadius}
                onChange={(e) => onRadiusChange(Number(e.target.value))}
                disabled={isSheet ? false : !hasLocation}
                onPointerDown={isSheet ? handleRadiusPointerDown : undefined}
                onPointerUp={isSheet ? handleRadiusPointerUp : undefined}
                onPointerCancel={isSheet ? handleRadiusPointerCancel : undefined}
                className={`w-full cursor-pointer disabled:cursor-not-allowed ${isSheet ? 'h-7 mobile-radius-slider' : 'h-5'} ${hasLocation ? 'accent-blue-500 text-blue-600' : 'accent-gray-400 text-gray-400'}`}
                style={{ '--mobile-track-fill': radiusTrackFill } as React.CSSProperties}
              />
              {/* つまみ位置に重ねた透明ボタン（PC版のみ）：クリックで現在地表示のON/OFFを切り替える（線上クリックでの距離変更とは独立）。
                  モバイルはこのボタンがつまみのドラッグ操作を奪ってしまうため描画せず、input側のpointerdown/upでタップ/ドラッグを判別する */}
              {!isSheet && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={hasLocation}
                  aria-label="現在地を表示"
                  onClick={hasLocation ? onLocateClear : onLocate}
                  disabled={locateStatus === 'loading'}
                  className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-transparent cursor-pointer disabled:cursor-wait"
                  style={{ left: radiusThumbLeft }}
                />
              )}
            </div>
          </div>
        </div>

        <div>
          <span className="text-sm" style={{ color: '#1F1F1F' }}>カテゴリ</span>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {(Object.keys(CATEGORY_LABELS) as Category[]).filter((cat) => cat !== 'event_plus').map((cat) => {
              const active = activeCategories.has(cat)
              return (
                <button
                  key={cat}
                  onClick={() => onCategoryToggle(cat)}
                  className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full transition-colors cursor-pointer border ${
                    active
                      ? 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                      : 'bg-gray-100 border-transparent text-gray-400 hover:bg-gray-200'
                  }`}
                  style={{ fontSize: 13, lineHeight: 1 }}
                >
                  <CategoryIcon category={cat} active={active} size={15} />
                  {CATEGORY_BUTTON_LABEL_OVERRIDES[cat] ?? CATEGORY_LABELS[cat]}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* スポット一覧（サイドバーモードのみタイトル行を表示） */}
      <div className={`${isSheet ? '' : 'flex-1 min-h-0'} overflow-y-auto border-t border-gray-200`}>
        <div className={`${isSheet ? 'py-3' : 'py-1.5'} pr-3`}>
          {!isSheet && (
            <p className="text-sm mb-1.5" style={{ paddingLeft: 22, color: '#1F1F1F' }}>
              スポット一覧　<span className="text-xs text-gray-700">{spots.length}件表示中</span>
            </p>
          )}
          <div className="space-y-0">
            {spots.map((spot) => {
              const dateDisplay = getDateDisplay(spot.scheduleNote, spot.startDate, spot.endDate)
              const timeDisplay = fmtTimeRange(spot.startTime, spot.endTime)
              return (
                <button
                  key={spot.id}
                  onClick={() => {
                    if (isSheet && onSpotSelect) {
                      onSpotSelect(selectedSpot?.id === spot.id ? null : spot)
                    } else {
                      selectedSpot?.id === spot.id ? onDetailClose() : onDetailOpen(spot)
                    }
                  }}
                  className={`w-full text-left py-1 pr-3 rounded-lg text-sm transition-colors cursor-pointer ${
                    selectedSpot?.id === spot.id
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                  style={{ paddingLeft: 24 }}
                >
                  <div className="flex items-center gap-2">
                    <CategoryIcon category={spot.category} size={20} />
                    <span className="text-sm leading-tight flex-1 min-w-0 truncate" style={{ color: '#1F1F1F' }}>
                      {spot.name}
                    </span>
                  </div>
                  {dateDisplay && (
                    <p className="text-[11px] text-gray-500 truncate mt-0.5 pl-7">
                      {dateDisplay}{timeDisplay ? ` ${timeDisplay}` : ''}
                    </p>
                  )}
                </button>
              )
            })}
            {spots.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-8">
                条件に合うスポットがありません
              </p>
            )}
          </div>
        </div>
      </div>

      {/* フッターリンク */}
      <div className={`border-t border-gray-200 flex flex-col ${isSheet ? 'mb-10' : 'mb-1'}`}>
        {!isSheet && (
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSfjd2ErqEMLI7gDMk4O5iutIRSUMI6AD0hkJSnN3tAT5UjIXA/viewform"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-sm text-blue-500 underline pl-[22px] pr-3 py-1.5"
          >
            お問い合わせ
          </a>
        )}
        <p className={`text-[8px] text-gray-300 pl-[22px] pr-3 mt-auto ${isSheet ? 'pt-2' : 'pt-1'}`}>
          アイコン: <a href="https://openmoji.org/" target="_blank" rel="noopener noreferrer" className="underline">OpenMoji</a> (CC BY-SA 4.0) / <a href="https://github.com/googlefonts/noto-emoji" target="_blank" rel="noopener noreferrer" className="underline">Noto Emoji</a> (Apache 2.0)
        </p>
      </div>

    </aside>
  )
}
