'use client'

import { useState, useMemo, useEffect, useCallback, useLayoutEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import Sidebar from './Sidebar'
import DetailPanel from './DetailPanel'
import BottomSheet, { type SheetState } from './BottomSheet'
import { CATEGORY_LABELS, buildPeriodOptions, getVisualCategory, type Category, type PeriodFilter, type PeriodOption, type Spot } from '@/lib/spots'
import { eventToSpot, type EventsDatabase } from '@/lib/events'
import { getEventStatus, parseLocalDate } from '@/lib/date-utils'

const GUNMAP_INFO_SPOT: Spot = {
  id: '__gunmap_info__',
  name: 'GUNMAp｜グンマップ',
  category: 'event',
  type: 'event',
  lat: 36.3,
  lng: 139.1,
  description: '群馬の「旬」を、地図で発見\n週末の「行きたい」が見つかる、地域のおでかけマップ',
  weekendDates: [],
  imageUrl: '/gunmap_OGP_05.png',
}

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
      parsed.periodFilter = parsed.weekendOnly ? '2w' : '3m'
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
  const searchParams = useSearchParams()
  const eventParamHandled = useRef(false)
  // flyToアニメーション中はzoomLevel更新を抑制し、pinGroups再計算によるチラつきを防ぐ
  const isFlyingRef = useRef(false)

  const [isMobile, setIsMobile] = useState(false)

  useLayoutEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('3m')
  const [activeCategories, setActiveCategories] = useState<Set<Category>>(
    () => {
      const all = new Set(Object.keys(CATEGORY_LABELS) as Category[])
      all.delete('park')
      return all
    }
  )
  const [selectedSpot,   setSelectedSpot]   = useState<Spot | null>(null)
  const [detailSpot,     setDetailSpot]     = useState<Spot | null>(null)
  const [temporarySpot,  setTemporarySpot]  = useState<Spot | null>(null)
  const [detailSheetHeight, setDetailSheetHeight] = useState<'50vh' | '100dvh'>('50vh')
  const [sheetState,     setSheetState]     = useState<SheetState>('closed')
  const [collectedSpots, setCollectedSpots] = useState<Spot[]>([])
  const [periodOptions, setPeriodOptions] = useState<PeriodOption[]>(buildPeriodOptions([2026]))
  const [userLocation,  setUserLocation]    = useState<[number, number] | null>(null)
  const [locateStatus,  setLocateStatus]    = useState<'idle' | 'loading'>('idle')
  const [locationRadius, setLocationRadius] = useState(20)
  const [recenterSignal, setRecenterSignal] = useState(0)
  const [zoomLevel, setZoomLevel] = useState(12)

  // ハイドレーション後にlocalStorageから設定を復元
  useEffect(() => {
    const saved = loadSettings()
    if (saved.periodFilter !== undefined) {
      // 廃止された期間フィルタ値が保存されている場合は '3m' にフォールバック
      const REMOVED_PERIOD_FILTERS = new Set(['2m', '6m', 'all'])
      setPeriodFilter(
        REMOVED_PERIOD_FILTERS.has(saved.periodFilter) ? '3m' : saved.periodFilter
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
    setTemporarySpot(null)
  }, [])

  const handleDetailOpen = useCallback((spot: Spot) => {
    setDetailSpot(spot)
    setSelectedSpot(spot)
  }, [])

  const handleFlyStart = useCallback(() => {
    isFlyingRef.current = true
  }, [])

  const handleFlyEnd = useCallback(() => {
    isFlyingRef.current = false
  }, [])

  const handleZoomChange = useCallback((zoom: number) => {
    if (isFlyingRef.current) return
    setZoomLevel(zoom)
  }, [])

  useEffect(() => {
    setDetailSheetHeight('50vh')
  }, [detailSpot])

  const handleDetailClose = useCallback(() => {
    setDetailSpot(null)
    setSelectedSpot(null)
    setTemporarySpot(null)
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
      const spots = db.events.map(eventToSpot)
      setCollectedSpots(spots)
      // 終了イベントが存在する年を集計してプルダウンを更新
      const endedYears = Array.from(
        new Set(
          spots
            .filter((s) => s.endDate && getEventStatus(s.startDate, s.endDate) === 'ended')
            .map((s) => new Date(s.endDate!).getFullYear())
        )
      )
      setPeriodOptions(buildPeriodOptions(endedYears))
    } catch {
      // events.json がまだない場合は無視
    }
  }, [])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  // /events/[id] からのリダイレクト（?event=xxx）を受けて、該当スポットの詳細を開き地図を移動する
  useEffect(() => {
    if (eventParamHandled.current) return
    if (collectedSpots.length === 0) return
    const eventId = searchParams.get('event')
    if (!eventId) return

    eventParamHandled.current = true
    const spot = collectedSpots.find((s) => s.id === eventId)
    if (spot) {
      if (getEventStatus(spot.startDate, spot.endDate) === 'ended') {
        setTemporarySpot(spot)
      }
      handleDetailOpen(spot)
    }
    window.history.replaceState(null, '', '/')
  }, [collectedSpots, searchParams, handleDetailOpen])

  useEffect(() => {
    handleLocate()
  }, [handleLocate])

  const allSpots = useMemo(() => collectedSpots, [collectedSpots])

  const filteredSpots = useMemo(() => {
    const filtered = allSpots.filter((spot) => {
      const categoryActive = spot.category === 'event_plus'
        ? activeCategories.has(getVisualCategory(spot) as Category)
        : activeCategories.has(spot.category)
      if (!categoryActive) return false

      if (periodFilter.startsWith('ended_')) {
        const year = parseInt(periodFilter.replace('ended_', ''), 10)
        if (spot.type === 'permanent') return false
        if (getEventStatus(spot.startDate, spot.endDate) !== 'ended') return false
        return !!spot.endDate && spot.endDate >= `${year}-01-01` && spot.endDate <= `${year}-12-31`
      }

      // 常設施設は期限切れ判定・期間フィルタの対象外で常に表示する
      if (spot.type === 'permanent') return true
      if (getEventStatus(spot.startDate, spot.endDate) === 'ended') return false
      // 期間の終了日を計算
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const cutoff = new Date(today)
      switch (periodFilter) {
        case '1w': cutoff.setDate(cutoff.getDate() + 7); break
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
    })

    // 過去イベント一覧（ended_年）は終了日が新しい順のまま
    if (periodFilter.startsWith('ended_')) {
      return [...filtered].sort((a, b) => (b.endDate ?? '').localeCompare(a.endDate ?? ''))
    }

    // 終了日が近い順で統一ソート。日程未定（endDateなし）は末尾、endDateが同じ場合はstartDate昇順
    return [...filtered].sort((a, b) => {
      if (!a.endDate && !b.endDate) return (a.startDate ?? '').localeCompare(b.startDate ?? '')
      if (!a.endDate) return 1
      if (!b.endDate) return -1
      const endCompare = a.endDate.localeCompare(b.endDate)
      if (endCompare !== 0) return endCompare
      return (a.startDate ?? '').localeCompare(b.startDate ?? '')
    })
  }, [allSpots, periodFilter, activeCategories])

  // 終了イベントの ?event= リンクから来た場合、フィルターは変えずにピン表示にだけ一時追加する
  const displaySpots = useMemo(() => {
    if (!temporarySpot) return filteredSpots
    if (filteredSpots.some((s) => s.id === temporarySpot.id)) return filteredSpots
    return [...filteredSpots, temporarySpot]
  }, [filteredSpots, temporarySpot])

  // event_plus: 会場（lat/lng）が複数ある場合、地図には会場ごとに別ピンを表示する。
  // サイドバー一覧（filteredSpots）は1件のまま変更しない。
  const mapSpots = useMemo(() => {
    const result: Spot[] = []
    for (const spot of displaySpots) {
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
  }, [displaySpots])

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
    periodOptions,
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
          onZoomChange={handleZoomChange}
          onFlyStart={handleFlyStart}
          onFlyEnd={handleFlyEnd}
        />
        {/* タイトルボタン */}
        <div className="fixed top-4 left-4" style={{ zIndex: 999 }}>
          <button
            onClick={() => { setDetailSpot(GUNMAP_INFO_SPOT); setSelectedSpot(null); setSheetState('closed') }}
            className="block cursor-pointer select-none overflow-hidden rounded-full"
            style={{ width: 55, height: 55, boxShadow: '0 2px 6px rgba(0,0,0,0.25), 0 8px 20px rgba(0,0,0,0.15)' }}
          >
            <img src="/gunmap_icon_02.png" alt="GUNMAP" width={55} height={55} className="h-full w-full object-cover" />
          </button>
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
        {/* タイトルボタン（PC） */}
        <div className="absolute top-4 left-4" style={{ zIndex: 999 }}>
          <button
            onClick={() => { setDetailSpot(GUNMAP_INFO_SPOT); setSelectedSpot(null) }}
            className="block cursor-pointer select-none overflow-hidden rounded-full"
            style={{ width: 55, height: 55, boxShadow: '0 2px 6px rgba(0,0,0,0.25), 0 8px 20px rgba(0,0,0,0.15)' }}
          >
            <img src="/gunmap_icon_02.png" alt="GUNMAP" width={55} height={55} className="h-full w-full object-cover" />
          </button>
        </div>
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
          onZoomChange={handleZoomChange}
          onFlyStart={handleFlyStart}
          onFlyEnd={handleFlyEnd}
        />
      </main>
    </div>
  )
}

