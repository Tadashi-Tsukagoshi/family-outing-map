'use client'

import { useState, useMemo, useEffect, useCallback, useLayoutEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import Sidebar from './Sidebar'
import DetailPanel from './DetailPanel'
import BottomSheet, { type SheetState } from './BottomSheet'
import { CATEGORY_LABELS, type Category, type Spot } from '@/lib/spots'
import { eventToSpot, type EventsDatabase } from '@/lib/events'
import { getEventStatus } from '@/lib/date-utils'

// ─── 設定の永続化 ────────────────────────────────────────────────
const STORAGE_KEY = 'outing-map-settings'

type SavedSettings = {
  weekendOnly: boolean
  activeCategories: Category[]
}

function loadSettings(): Partial<SavedSettings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SavedSettings) : {}
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

function getThisWeekendDates(): string[] {
  const today = new Date()
  const day = today.getDay()
  const fmt = (d: Date) => d.toISOString().split('T')[0]

  if (day === 6) {
    const sun = new Date(today)
    sun.setDate(today.getDate() + 1)
    return [fmt(today), fmt(sun)]
  }
  if (day === 0) {
    const sat = new Date(today)
    sat.setDate(today.getDate() - 1)
    return [fmt(sat), fmt(today)]
  }
  const sat = new Date(today)
  sat.setDate(today.getDate() + (6 - day))
  const sun = new Date(sat)
  sun.setDate(sat.getDate() + 1)
  return [fmt(sat), fmt(sun)]
}

export default function MapApp() {
  const [isMobile, setIsMobile] = useState(false)
  const [headerExpanded, setHeaderExpanded] = useState(true)
  const logoRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const [weekendOnly, setWeekendOnly] = useState(false)
  const [activeCategories, setActiveCategories] = useState<Set<Category>>(
    () => new Set(Object.keys(CATEGORY_LABELS) as Category[])
  )
  const [selectedSpot,   setSelectedSpot]   = useState<Spot | null>(null)
  const [detailSpot,     setDetailSpot]     = useState<Spot | null>(null)
  const [sheetState,     setSheetState]     = useState<SheetState>('closed')
  const [collectedSpots, setCollectedSpots] = useState<Spot[]>([])
  const [userLocation,  setUserLocation]    = useState<[number, number] | null>(null)
  const [locateStatus,  setLocateStatus]    = useState<'idle' | 'loading'>('idle')
  const [locationRadius, setLocationRadius] = useState(10)
  const [recenterSignal, setRecenterSignal] = useState(0)

  // ハイドレーション後にlocalStorageから設定を復元
  useEffect(() => {
    const saved = loadSettings()
    if (saved.weekendOnly !== undefined)    setWeekendOnly(saved.weekendOnly)
    if (saved.activeCategories) {
      // 旧カテゴリ構成（park/museum/playground/food/event/music/exhibition）からの移行措置:
      // 新設カテゴリ（fireworks/festival）は保存データに存在しなくてもデフォルトでオンにする
      const OLD_CATEGORIES = new Set(['park', 'museum', 'playground', 'food', 'event', 'music', 'exhibition'])
      const restored = new Set<Category>()
      for (const cat of Object.keys(CATEGORY_LABELS) as Category[]) {
        if (saved.activeCategories.includes(cat) || !OLD_CATEGORIES.has(cat)) restored.add(cat)
      }
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

  const handleDetailClose = useCallback(() => {
    setDetailSpot(null)
    setSelectedSpot(null)
  }, [])

  useEffect(() => {
    saveSettings({
      weekendOnly,
      activeCategories: Array.from(activeCategories),
    })
  }, [weekendOnly, activeCategories, locationRadius])

  const weekendDates = useMemo(() => getThisWeekendDates(), [])

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
      if (!activeCategories.has(spot.category)) return false
      if (getEventStatus(spot.startDate, spot.endDate) === 'ended') return false
      if (weekendOnly) {
        // 期間情報があるイベント: 週末がその期間内に含まれるか確認
        if (spot.startDate && spot.endDate) {
          return weekendDates.some(
            (d) => spot.startDate! <= d && d <= spot.endDate!,
          )
        }
        // 固定スポット: 事前設定の weekendDates で判定
        return spot.weekendDates.some((d) => weekendDates.includes(d))
      }
      return true
    })
  }, [allSpots, weekendOnly, activeCategories, weekendDates])

  const toggleCategory = (cat: Category) => {
    setActiveCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const sidebarProps = {
    weekendOnly,
    onWeekendToggle: () => setWeekendOnly((v) => !v),
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
    onLocate: () => { handleLocate(); setSheetState('closed') },
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
          spots={filteredSpots}
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
        />
        {/* タイトルボタン＋ポップアップ */}
        <div ref={logoRef} className="fixed top-4 left-4" style={{ zIndex: 999 }}>
          <button
            onClick={() => setHeaderExpanded(v => !v)}
            className="inline-flex items-center px-3 py-1 rounded-full text-sm text-white cursor-pointer select-none"
            style={{ backgroundColor: '#4a4a4a', boxShadow: '0 2px 6px rgba(0,0,0,0.25), 0 8px 20px rgba(0,0,0,0.15)' }}
          >
            群馬県おでかけまっぷ
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
                minWidth: 260,
              }}
            >
              <p className="text-xs text-gray-500 leading-relaxed" style={{ whiteSpace: 'nowrap' }}>
                今週末、家族でどこ行く？<br />群馬県のイベントを地図で発見！
              </p>
              <a
                href="https://docs.google.com/forms/d/e/1FAIpQLSfjd2ErqEMLI7gDMk4O5iutIRSUMI6AD0hkJSnN3tAT5UjIXA/viewform?usp=publish-editor"
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="inline-block mt-2 text-xs text-blue-500 underline"
              >
                イベント情報をお寄せください
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
              height: '50vh',
              borderRadius: '16px 16px 0 0',
              boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
            }}
          >
            <DetailPanel spot={detailSpot} onClose={() => { handleDetailClose(); setSheetState('mid') }} mobile />
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
          <div className="absolute inset-y-0 left-0 z-[500]">
            <DetailPanel spot={detailSpot} onClose={handleDetailClose} />
          </div>
        )}
        <MapView
          spots={filteredSpots}
          selectedSpot={selectedSpot}
          onSpotSelect={setSelectedSpot}
          onDetailOpen={handleDetailOpen}
          onDetailClose={handleDetailClose}
          detailPanelOpen={detailSpot !== null}
          userLocation={userLocation}
          locationRadius={locationRadius}
          recenterSignal={recenterSignal}
        />
      </main>
    </div>
  )
}

