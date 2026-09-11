'use client'

export type AreaCount = { name: string; count: number }

const ALL_LABEL = 'すべて'
const OTHER_LABEL = 'その他'
const ACTIVE_GRADIENT = 'linear-gradient(to right, #2f50c7, #5fb48c)'

type Props = {
  /** 登録数上位N件（表示順ソート済み） */
  areas: AreaCount[]
  activeArea: string | null
  onAreaChange: (area: string | null) => void
  /** 上位N件に入らなかったエリアが1件でもあるか（「その他」チップの表示要否） */
  hasOther: boolean
  /** 選択中のエリアが「その他」側に含まれているか（「その他」チップをアクティブ色にする） */
  otherActive: boolean
  onOtherClick: () => void
  /** ボトムシートの直上に密着させるための位置スタイル（bottom/transitionを含む） */
  positionStyle: React.CSSProperties
}

function chipStyle(active: boolean): React.CSSProperties {
  return active
    ? {
        background: ACTIVE_GRADIENT,
        // 角丸ピル形状のため、境界線の内側にだけ背景を描画してborder-radiusの丸みと背景の描画範囲を一致させる
        backgroundClip: 'padding-box',
        WebkitBackgroundClip: 'padding-box',
        borderColor: 'transparent',
        color: '#fff',
        boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
      }
    : { background: 'rgba(255,255,255,0.92)', borderColor: '#e5e7eb', color: '#4b5563' }
}

export default function AreaChips({ areas, activeArea, onAreaChange, hasOther, otherActive, onOtherClick, positionStyle }: Props) {
  return (
    <div
      className="no-scrollbar fixed left-0 right-0 flex gap-2 overflow-x-auto px-4 py-2"
      style={{ ...positionStyle, zIndex: 1000 }}
    >
      <button
        type="button"
        onClick={() => onAreaChange(null)}
        className="appearance-none shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer"
        style={chipStyle(activeArea === null)}
      >
        {ALL_LABEL}
      </button>

      {areas.map((area) => (
        <button
          key={area.name}
          type="button"
          onClick={() => onAreaChange(area.name)}
          className="appearance-none shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer"
          style={chipStyle(activeArea === area.name)}
        >
          {area.name}
        </button>
      ))}

      {hasOther && (
        <button
          type="button"
          onClick={onOtherClick}
          className="appearance-none shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer"
          style={chipStyle(otherActive)}
        >
          {OTHER_LABEL}
        </button>
      )}
    </div>
  )
}
