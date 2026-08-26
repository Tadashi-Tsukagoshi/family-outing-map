'use client'

import { useState, useMemo, useEffect, useCallback, useLayoutEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import Sidebar from './Sidebar'
import DetailPanel from './DetailPanel'
import BottomSheet, { type SheetState } from './BottomSheet'
import { CATEGORY_LABELS, getVisualCategory, type Category, type PeriodFilter, type Spot } from '@/lib/spots'
import { eventToSpot, type EventsDatabase } from '@/lib/events'
import { getEventStatus, parseLocalDate } from '@/lib/date-utils'

// ─── 地図ピンのグループ化（同じ groupId のイベントをまとめる） ──────────
/** グループ内メンバー間の画面ピクセル距離がこれを超えるとズームインでグループ解除する */
const DISSOLVE_PX = 15

export type PinGroup = {
  /** 最前面（吹き出しの先頭）に表示する spot の id */
  representativeId: string
  /** グループ内の全 spot（開催日の近さ順にソート済み） */
  spots: Spot[]
  lat: number
  lng: number
}

/** グループ内ソート用の優先度。値が大きいほど前面（先頭）。z-index 計算ロジックと同じ優先順位 */
function pinSortRank(spot: Spot, todayStartMs: number): number {
  const status = getEventStatus(spot.startDate, spot.endDate)
  if (status === 'active') return 500
  if ((status === 'upcoming' || status === 'scheduled') && spot.startDate) {
    const daysUntil = Math.ceil((parseLocalDate(spot.startDate).getTime() - todayStartMs) / 86400000)
    return Math.max(1, Math.min(499, 500 - daysUntil))
  }
  return 0
}

// ─── 設定の永続化 ────────────────────────────────────────────────
const STORAGE_KEY = 'outing-map-settings'

type SavedSettings = {
  periodFilter: PeriodFilter
  activeCategories: Category[]
}

function loadSettings(): Partial<SavedSettings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Partial<SavedSettings> & { weekendOnly?: boolean }
    if (parsed.periodFilter === undefined && parsed.weekendOnly !== undefined) {
      parsed.periodFilter = parsed.weekendOnly ? '2w' : 'all'
    }
    return parsed
  } catch {
    return {}
  }
}

function saveSettings(s: SavedSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {}
}

const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-gray-100">
      <p className="text-gray-500 text-sm">地図を読み込み中...</p>
    </div>
  ),
})

export default function MapApp() {
  const [isMobile, setIsMobile] = useState(false)
  const [headerExpanded, setHeaderExpanded] = useState(false)
  const logoRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all')
  const [activeCategories, setActiveCategories] = useState<Set<Category>>(
    () => {
      const all = new Set(Object.keys(CATEGORY_LABELS) as Category[])
      all.delete('park')
      return all
    }
  )
  const [selectedSpot,   setSelectedSpot]   = useState<Spot | null>(null)
  const [detailSpot,     setDetailSpot]     = useState<Spot | null>(null)
  const [detailSheetHeight, setDetailSheetHeight] = useState<'50vh' | '100dvh'>('50vh')
  const [sheetState,     setSheetState]     = useState<SheetState>('closed')
  const [collectedSpots, setCollectedSpots] = useState<Spot[]>([])
  const [userLocation,  setUserLocation]    = useState<[number, number] | null>(null)
  const [locateStatus,  setLocateStatus]    = useState<'idle' | 'loading'>('idle')
  const [locationRadius, setLocationRadius] = useState(20)
  const [recenterSignal, setRecenterSignal] = useState(0)
  const [zoomLevel, setZoomLevel] = useState(12)

  // ハイドレーション後にlocalStorageから設定を復元
  useEffect(() => {
    const saved = loadSettings()
    if (saved.periodFilter !== undefined) {
      // 廃止された期間フィルタ値が保存されている場合は 'all' にフォールバック
      const REMOVED_PERIOD_FILTERS = new Set(['2m', '6m'])
      setPeriodFilter(
        REMOVED_PERIOD_FILTERS.has(saved.periodFilter) ? 'all' : saved.periodFilter
      )
    }
    if (saved.activeCategories) {
      // 旧カテゴリ構成（park/museum/playground/food/event/music/exhibition）からの移行措置:
      // 新設カテゴリ（fireworks/festival）は保存データに存在しなくてもデフォルトでオンにする
      const OLD_CATEGORIES = new Set(['park', 'museum', 'playground', 'food', 'event', 'music', 'exhibition'])
      const restored = new Set<Category>()
      for (const cat of Object.keys(CATEGORY_LABELS) as Category[]) {
        if (saved.activeCategories.includes(cat) || !OLD_CATEGORIES.has(cat)) restored.add(cat)
      }
      restored.delete('park') // 施設・公園は毎回起動時に非表示
      setActiveCategories(restored)
    }
  }, [])

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) { setLocateStatus('idle'); setRecenterSignal((n) => n + 1); return }
    setLocateStatus('loading')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude])
        setLocateStatus('idle')
      },
      (err) => {
        // PERMISSION_DENIED=1 / POSITION_UNAVAILABLE=2 / TIMEOUT=3
        console.warn(`[geolocation] failed (code=${err.code}): ${err.message}`)
        setLocateStatus('idle')
        // 取得失敗時はエラー表示の代わりに太田市中心へ地図を戻す
        setRecenterSignal((n) => n + 1)
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    )
  }, [])

  const handleLocateClear = useCallback(() => {
    setUserLocation(null)
    setLocateStatus('idle')
    setSelectedSpot(null)
    setDetailSpot(null)
  }, [])

  const handleDetailOpen = useCallback((spot: Spot) => {
    setDetailSpot(spot)
    setSelectedSpot(spot)
  }, [])

  useEffect(() => {
    setDetailSheetHeight('50vh')
  }, [detailSpot])

  const handleDetailClose = useCallback(() => {
    setDetailSpot(null)
    setSelectedSpot(null)
  }, [])

  useEffect(() => {
    saveSettings({
      periodFilter,
      activeCategories: Array.from(activeCategories),
    })
  }, [periodFilter, activeCategories, locationRadius])

  const loadEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/events')
      const db: EventsDatabase = await res.json()
      setCollectedSpots(db.events.map(eventToSpot))
    } catch {
      // events.json がまだない場合は無視
    }
  }, [])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  useEffect(() => {
    handleLocate()
  }, [handleLocate])

  useEffect(() => {
    if (!headerExpanded) return
    const close = (e: Event) => {
      if (logoRef.current && !logoRef.current.contains(e.target as Node)) {
        setHeaderExpanded(false)
      }
    }
    document.addEventListener('touchstart', close, { passive: true })
    document.addEventListener('mousedown', close)
    return () => {
      document.removeEventListener('touchstart', close)
      document.removeEventListener('mousedown', close)
    }
  }, [headerExpanded])

  const allSpots = useMemo(() => collectedSpots, [collectedSpots])

  const filteredSpots = useMemo(() => {
    return allSpots.filter((spot) => {
      const categoryActive = spot.category === 'event_plus'
        ? activeCategories.has(getVisualCategory(spot) as Category)
        : activeCategories.has(spot.category)
      if (!categoryActive) return false

      if (periodFilter === 'ended_2026') {
        if (spot.type === 'permanent') return false
        if (getEventStatus(spot.startDate, spot.endDate) !== 'ended') return false
        // 2026年に終了したイベントのみ
        return !!spot.endDate && spot.endDate >= '2026-01-01'
      }

      // 常設施設は期限切れ判定・期間フィルタの対象外で常に表示する
      if (spot.type === 'permanent') return true
      if (getEventStatus(spot.startDate, spot.endDate) === 'ended') return false
      if (periodFilter !== 'all') {
        // 期間の終了日を計算
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const cutoff = new Date(today)
        switch (periodFilter) {
          case '2w': cutoff.setDate(cutoff.getDate() + 14); break
          case '1m': cutoff.setMonth(cutoff.getMonth() + 1); break
          case '3m': cutoff.setMonth(cutoff.getMonth() + 3); break
        }
        const cutoffStr = cutoff.toISOString().split('T')[0]
        const todayStr = today.toISOString().split('T')[0]
        // 日付のあるイベント: 開始日が期間内、または期間内に開催中
        if (spot.startDate || spot.endDate) {
          const start = spot.startDate ?? spot.endDate!
          const end = spot.endDate ?? spot.startDate!
          // イベント期間と選択期間が重なるか判定
          return start <= cutoffStr && end >= todayStr
        }
        // 日程未定（schedule_noteのみ）のイベントは常に表示
        return true
      }
      return true
    })
  }, [allSpots, periodFilter, activeCategories])

  // event_plus: 会場（lat/lng）が複数ある場合、地図には会場ごとに別ピンを表示する。
  // サイドバー一覧（filteredSpots）は1件のまま変更しない。
  const mapSpots = useMemo(() => {
    const result: Spot[] = []
    for (const spot of filteredSpots) {
      const pins = spot.category === 'event_plus' ? spot.eventPlusPins : undefined
      if (!pins || pins.length <= 1) {
        result.push(spot)
        continue
      }
      pins.forEach((pin, i) => {
        result.push({
          ...spot,
          id: i === 0 ? spot.id : `${spot.id}::${i}`,
          eventId: spot.id,
          startDate: pin.startDate,
          endDate: pin.endDate,
          startTime: pin.startTime,
          endTime: pin.endTime,
          venue: pin.venue,
          address: pin.address,
          lat: pin.lat,
          lng: pin.lng,
        })
      })
    }
    return result
  }, [filteredSpots])

  // 1) 同じ groupId の mapSpots 同士をグループ化（ズームインしてメンバー間の画面ピクセル距離が
  //    DISSOLVE_PX を超えるとグループを解除し、各spotが個別座標で表示される）。
  // 2) group_id を持たない残りの spot は、座標完全一致（1e-6 tolerance）でグループ化する
  //    （座標が同一のためズームでは解除しない）。
  // 3) どちらにも属さない spot は個別の PinGroup。
  const pinGroups = useMemo<PinGroup[]>(() => {
    const todayStartMs = new Date().setHours(0, 0, 0, 0)
    const pixelsPerDeg = 256 * Math.pow(2, zoomLevel) / 360
    const groups: PinGroup[] = []

    const buildSingle = (spot: Spot): PinGroup => ({
      representativeId: spot.id,
      spots: [spot],
      lat: spot.lat,
      lng: spot.lng,
    })

    const buildGroup = (members: Spot[]): PinGroup => {
      const sorted = [...members].sort((a, b) => pinSortRank(b, todayStartMs) - pinSortRank(a, todayStartMs))
      return {
        representativeId: sorted[0].id,
        spots: sorted,
        lat: members.reduce((s, m) => s + m.lat, 0) / members.length,
        lng: members.reduce((s, m) => s + m.lng, 0) / members.length,
      }
    }

    // ─── 1. group_id ベースのグルーピング（ズーム連動で解除） ─────────
    const byGroupId = new Map<string, Spot[]>()
    const remaining: Spot[] = []
    for (const spot of mapSpots) {
      if (!spot.groupId) { remaining.push(spot); continue }
      const members = byGroupId.get(spot.groupId)
      if (members) members.push(spot)
      else byGroupId.set(spot.groupId, [spot])
    }

    for (const members of byGroupId.values()) {
      if (members.length === 1) { groups.push(buildSingle(members[0])); continue }

      let maxDistPx = 0
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const distPx = Math.hypot(members[i].lat - members[j].lat, members[i].lng - members[j].lng) * pixelsPerDeg
          if (distPx > maxDistPx) maxDistPx = distPx
        }
      }

      if (maxDistPx > DISSOLVE_PX) {
        for (const spot of members) groups.push(buildSingle(spot))
        continue
      }

      groups.push(buildGroup(members))
    }

    // ─── 2. 残りの spot を座標完全一致でグルーピング（ズームでは解除しない） ─
    const assigned = new Set<string>()
    for (const spot of remaining) {
      if (assigned.has(spot.id)) continue
      const coordGroup: Spot[] = [spot]
      assigned.add(spot.id)

      for (const other of remaining) {
        if (assigned.has(other.id)) continue
        if (Math.abs(other.lat - spot.lat) <= 1e-6 && Math.abs(other.lng - spot.lng) <= 1e-6) {
          coordGroup.push(other)
          assigned.add(other.id)
        }
      }

      // ─── 3. マッチする座標がなければ個別の PinGroup ───────────────
      groups.push(coordGroup.length > 1 ? buildGroup(coordGroup) : buildSingle(spot))
    }

    return groups
  }, [mapSpots, zoomLevel])

  const toggleCategory = (cat: Category) => {
    setActiveCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const sidebarProps = {
    periodFilter,
    onPeriodChange: setPeriodFilter,
    activeCategories,
    onCategoryToggle: toggleCategory,
    spots: filteredSpots,
    selectedSpot,
    onDetailOpen: handleDetailOpen,
    onDetailClose: handleDetailClose,
    onSpotSelect: (spot: Spot | null) => {
      if (spot) {
        handleDetailOpen(spot)
        setSheetState('closed')
      } else {
        handleDetailClose()
      }
    },
    // 現在地表示ONにする際はボトムシートを閉じず、閉じている/フルの場合は真ん中（mid）にする
    onLocate: () => { handleLocate(); setSheetState('mid') },
    onLocateClear: handleLocateClear,
    hasLocation: userLocation !== null,
    locateStatus,
    locationRadius,
    onRadiusChange: setLocationRadius,
  }


  /* ── モバイルレイアウト ── */
  if (isMobile) {
    return (
      <div className="relative h-full w-full">
        <MapView
          spots={mapSpots}
          pinGroups={pinGroups}
          selectedSpot={selectedSpot}
          onSpotSelect={setSelectedSpot}
          onDetailOpen={handleDetailOpen}
          onDetailClose={handleDetailClose}
          detailPanelOpen={detailSpot !== null}
          userLocation={userLocation}
          locationRadius={locationRadius}
          recenterSignal={recenterSignal}
          isMobile
          sheetState={sheetState}
          onMapTapClose={() => setSheetState('closed')}
          onZoomChange={setZoomLevel}
        />
        {/* タイトルボタン＋ポップアップ */}
        <div ref={logoRef} className="fixed top-4 left-4" style={{ zIndex: 999 }}>
          <button
            onClick={() => setHeaderExpanded(v => !v)}
            className="block cursor-pointer select-none overflow-hidden rounded-full"
            style={{ width: 52, height: 52, boxShadow: '0 2px 6px rgba(0,0,0,0.25), 0 8px 20px rgba(0,0,0,0.15)' }}
          >
            <img src="/gunmap_icon_01.png" alt="GUNMAP" width={52} height={52} className="h-full w-full object-cover" />
          </button>
          {/* ポップアップ */}
          {headerExpanded && (
            <div
              onClick={() => setHeaderExpanded(false)}
              className="absolute top-full left-0 mt-1"
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 8,
                boxShadow: '0 2px 6px rgba(0,0,0,0.25), 0 8px 20px rgba(0,0,0,0.15)',
                padding: '6px 12px',
              }}
            >
              <p className="text-sm font-bold text-gray-700 leading-relaxed" style={{ whiteSpace: 'nowrap' }}>
                GUNMAP ｜グンマップ
              </p>
              <p className="text-xs text-gray-500 leading-relaxed" style={{ whiteSpace: 'nowrap' }}>
                群馬の週末おでかけプラットフォーム
              </p>
              <a
                href="https://docs.google.com/forms/d/e/1FAIpQLSfjd2ErqEMLI7gDMk4O5iutIRSUMI6AD0hkJSnN3tAT5UjIXA/viewform"
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="inline-block mt-2 text-xs text-blue-500 underline"
              >
                お問い合わせ
              </a>
            </div>
          )}
        </div>

        <BottomSheet
          spotCount={filteredSpots.length}
          sheetState={sheetState}
          onSheetStateChange={setSheetState}
        >
          <Sidebar {...sidebarProps} mode="sheet" />
        </BottomSheet>
        {detailSpot && (
          <div
            key={detailSpot.id}
            className="detail-sheet-enter fixed bottom-0 left-0 right-0 z-[1001] overflow-hidden"
            style={{
              height: detailSheetHeight,
              borderRadius: '16px 16px 0 0',
              boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
              transition: 'height 0.3s cubic-bezier(0.32,0.72,0,1)',
            }}
          >
            <DetailPanel
              spot={detailSpot}
              onClose={() => { handleDetailClose(); setSheetState('closed') }}
              onExpand={() => setDetailSheetHeight('100dvh')}
              onCollapse={() => setDetailSheetHeight('50vh')}
              expanded={detailSheetHeight === '100dvh'}
              mobile
            />
          </div>
        )}
      </div>
    )
  }

  /* ── デスクトップレイアウト ── */
  return (
    <div className="flex h-full">
      <Sidebar {...sidebarProps} mode="sidebar" />
      <main className="flex-1 relative">
        {detailSpot && (
          <div className="absolute inset-y-0 left-0 z-[1001]">
            <DetailPanel spot={detailSpot} onClose={handleDetailClose} />
          </div>
        )}
        <MapView
          spots={mapSpots}
          pinGroups={pinGroups}
          selectedSpot={selectedSpot}
          onSpotSelect={setSelectedSpot}
          onDetailOpen={handleDetailOpen}
          onDetailClose={handleDetailClose}
          detailPanelOpen={detailSpot !== null}
          userLocation={userLocation}
          locationRadius={locationRadius}
          recenterSignal={recenterSignal}
          onZoomChange={setZoomLevel}
        />
      </main>
    </div>
  )
}

