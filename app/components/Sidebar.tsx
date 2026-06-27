'use client'

import { CATEGORY_LABELS, getCategoryIconSrc, isDarkPin, type Category, type Spot } from '@/lib/spots'

type Props = {
  weekendOnly: boolean
  onWeekendToggle: () => void
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

function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean
  onChange: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-block h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus-visible:outline-none disabled:cursor-wait disabled:opacity-50 ${
        checked ? 'bg-blue-500' : 'bg-gray-300'
      }`}
    >
      <span
        className={`absolute top-[3px] h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-all duration-200 ${
          checked ? 'left-[19px]' : 'left-[3px]'
        }`}
      />
    </button>
  )
}

const ICON_RATIO: Record<Category, number> = { event: 0.92, fireworks: 0.78, festival: 0.92 }

export function CategoryIcon({ category, active = true, size = 20, id }: { category: Category; active?: boolean; size?: number; id?: string }) {
  const imgSize = Math.round(size * ICON_RATIO[category])
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, flexShrink: 0,
      ...(category === 'fireworks' ? { backgroundColor: '#1e1614', borderRadius: '50%', overflow: 'hidden' } : {}),
    }}>
      <img
        src={getCategoryIconSrc(category, active ? id : undefined)}
        alt=""
        style={{ width: imgSize, height: imgSize, objectFit: 'contain', display: 'block', opacity: active ? 1 : 0.35 }}
      />
    </span>
  )
}

export default function Sidebar({
  weekendOnly,
  onWeekendToggle,
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

  return (
    <aside className={`bg-white flex flex-col overflow-hidden ${isSheet ? 'w-full' : 'w-72 border-r border-gray-200'}`}>

      {/* タイトル（サイドバーモードのみ） */}
      {!isSheet && (
        <div className="p-4 pl-[22px] border-b border-gray-200">
          <h1 className="text-xl text-black" style={{ fontFamily: "'Shippori Mincho', serif" }}>群馬県おでかけまっぷ</h1>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            今週末、家族でどこ行く？<br />
            群馬県のイベントを地図で発見！
          </p>
        </div>
      )}

      {/* フィルター */}
      <div className="p-4 pl-[22px] space-y-5 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: '#1F1F1F' }}>今週末のみ表示</span>
          <Toggle checked={weekendOnly} onChange={onWeekendToggle} />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: '#1F1F1F' }}>現在地を表示</span>
            <Toggle
              checked={hasLocation || locateStatus === 'loading'}
              onChange={hasLocation ? onLocateClear : onLocate}
              disabled={locateStatus === 'loading'}
            />
          </div>

          <div className={`mt-3 pt-5 transition-opacity ${hasLocation ? 'opacity-100' : 'opacity-40'}`}>
            <div className="relative">
              <div
                className={`absolute -top-5 -translate-x-1/2 text-xs font-semibold tabular-nums pointer-events-none whitespace-nowrap ${hasLocation ? 'text-blue-600' : 'text-gray-400'}`}
                style={{
                  left: `calc(${((locationRadius - 10) / 50) * 100}% + ${8 - ((locationRadius - 10) / 50) * 16}px)`,
                }}
              >
                {locationRadius} km
              </div>
              <input
                type="range"
                min={10}
                max={60}
                step={10}
                value={locationRadius}
                onChange={(e) => onRadiusChange(Number(e.target.value))}
                disabled={!hasLocation}
                className={`w-full cursor-pointer disabled:cursor-not-allowed ${hasLocation ? 'accent-blue-500' : 'accent-gray-400'}`}
              />
            </div>
          </div>
        </div>

        <div>
          <span className="text-sm" style={{ color: '#1F1F1F' }}>カテゴリ</span>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {(Object.keys(CATEGORY_LABELS) as Category[]).map((cat) => {
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
                  {CATEGORY_LABELS[cat]}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* イベント一覧（サイドバーモードのみタイトル行を表示） */}
      <div className={`${isSheet ? '' : 'flex-1 min-h-0'} overflow-y-auto border-t border-gray-200`}>
        <div className="py-3 pr-3">
          {!isSheet && (
            <p className="text-sm mb-2" style={{ paddingLeft: 22, color: '#1F1F1F' }}>
              イベント一覧　<span className="text-xs text-gray-700">{spots.length}件表示中</span>
            </p>
          )}
          <div className="space-y-1">
            {spots.map((spot) => (
              <button
                key={spot.id}
                onClick={() => {
                  if (isSheet && onSpotSelect) {
                    onSpotSelect(selectedSpot?.id === spot.id ? null : spot)
                  } else {
                    selectedSpot?.id === spot.id ? onDetailClose() : onDetailOpen(spot)
                  }
                }}
                className={`w-full text-left py-2.5 pr-3 rounded-lg text-sm transition-colors cursor-pointer ${
                  selectedSpot?.id === spot.id
                    ? 'bg-blue-50 border border-blue-200'
                    : 'hover:bg-gray-50 border border-transparent'
                }`}
                style={{ paddingLeft: 24 }}
              >
                <div className="flex items-center gap-2">
                  <CategoryIcon category={spot.category} size={20} id={spot.id} />
                  <span className="text-sm leading-tight flex-1 min-w-0 truncate" style={{ color: '#1F1F1F' }}>
                    {spot.name}
                  </span>
                </div>
              </button>
            ))}
            {spots.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-8">
                条件に合うスポットがありません
              </p>
            )}
          </div>
        </div>
      </div>

      {/* フッターリンク */}
      <div className="border-t border-gray-200 flex flex-col mb-10">
        <a
          href="/ended-events"
          className="text-xs text-black flex items-center pl-[22px] pr-3"
          style={{ height: 36 }}
        >
          終了イベントを見る
        </a>
        {!isSheet && <div className="border-t border-gray-200" />}
        {!isSheet && (
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSfjd2ErqEMLI7gDMk4O5iutIRSUMI6AD0hkJSnN3tAT5UjIXA/viewform?usp=publish-editor"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs text-blue-500 underline pl-[22px] pr-3 py-3"
          >
            イベント情報をお寄せください
          </a>
        )}
        <p className="text-[10px] text-gray-400 pl-[22px] pr-3 mt-1">
          アイコン: <a href="https://openmoji.org/" target="_blank" rel="noopener noreferrer" className="underline">OpenMoji</a> (CC BY-SA 4.0) / <a href="https://github.com/googlefonts/noto-emoji" target="_blank" rel="noopener noreferrer" className="underline">Noto Emoji</a> (Apache 2.0)
        </p>
      </div>

    </aside>
  )
}
