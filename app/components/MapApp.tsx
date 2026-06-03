'use client'

import { useState, useMemo, useEffect, useCallback, useLayoutEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import Sidebar from './Sidebar'
import DetailPanel from './DetailPanel'
import BottomSheet from './BottomSheet'
import { CATEGORY_LABELS, type Category, type Spot } from '@/lib/spots'
import { eventToSpot, type EventsDatabase } from '@/lib/events'
import { getEventStatus } from '@/lib/date-utils'

// ─── 設定の永続化 ────────────────────────────────────────────────
const STORAGE_KEY = 'outing-map-settings'

type SavedSettings = {
  weekendOnly: boolean
  activeCategories: Category[]
  locationRadius: number
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
  const [sheetExpanded,  setSheetExpanded]  = useState(false)
  const [collectedSpots, setCollectedSpots] = useState<Spot[]>([])
  const [userLocation,  setUserLocation]    = useState<[number, number] | null>(null)
  const [locateStatus,  setLocateStatus]    = useState<'idle' | 'loading' | 'error'>('idle')
  const [locationRadius, setLocationRadius] = useState(20)

  // ハイドレーション後にlocalStorageから設定を復元
  useEffect(() => {
    const saved = loadSettings()
    if (saved.weekendOnly !== undefined)    setWeekendOnly(saved.weekendOnly)
    if (saved.activeCategories)             setActiveCategories(new Set(saved.activeCategories))
    if (saved.locationRadius !== undefined) setLocationRadius(saved.locationRadius)
  }, [])

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) { setLocateStatus('error'); return }
    setLocateStatus('loading')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude])
        setLocateStatus('idle')
      },
      () => setLocateStatus('error'),
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
      locationRadius,
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
      setSelectedSpot(spot)
      if (spot) setSheetExpanded(false)
    },
    onLocate: () => { handleLocate(); setSheetExpanded(false) },
    onLocateClear: handleLocateClear,
    hasLocation: userLocation !== null,
    locateStatus,
    locationRadius,
    onRadiusChange: setLocationRadius,
  }

  const adminButton = (extraClass: string) => (
    <a
      href="/admin"
      className={`absolute left-4 z-[999] flex items-center gap-1.5 px-4 py-2.5 rounded-full text-black text-sm font-medium transition-opacity hover:opacity-90 ${extraClass}`}
      style={{ backgroundColor: '#ffffff', boxShadow: '0 2px 6px rgba(0,0,0,0.25), 0 8px 20px rgba(0,0,0,0.15)' }}
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill="black" style={{ flexShrink: 0 }}>
        <path d="M19 11H13V5a1 1 0 0 0-2 0v6H5a1 1 0 0 0 0 2h6v6a1 1 0 0 0 2 0v-6h6a1 1 0 0 0 0-2z"/>
      </svg>
      イベントを登録・編集
    </a>
  )

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
          isMobile
        />
        {/* ロゴボタン＋ポップアップ */}
        <div ref={logoRef} className="fixed top-4 left-4" style={{ zIndex: 999 }}>
          {/* 丸ボタン */}
          <div
            onClick={() => setHeaderExpanded(v => !v)}
            className="flex items-center justify-center cursor-pointer select-none"
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              background: '#4a4a4a',
              boxShadow: '0 2px 6px rgba(0,0,0,0.25), 0 8px 20px rgba(0,0,0,0.15)',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
              <g transform="translate(2,1) scale(0.078)">
                <path d="M 0 96 C 45 68, 112 48, 168 42 C 220 36, 272 42, 316 58 C 288 100, 238 115, 182 106 C 134 97, 78 84, 30 102 Z" fill="white"/>
                <path d="M 124 6 C 142 -2, 184 6, 194 30 C 206 62, 190 128, 162 195 C 130 258, 82 316, 22 368 C -14 398, -50 418, -74 432 C -80 436, -85 432, -76 426 C -52 406, -14 378, 18 340 C 74 280, 120 202, 142 126 C 160 68, 166 36, 130 14 Z" fill="white"/>
                <path d="M 162 38 C 188 50, 216 78, 244 118 C 288 182, 336 246, 380 298 C 410 332, 440 364, 458 394 C 465 406, 458 416, 442 404 C 414 380, 380 344, 346 304 C 298 248, 244 178, 198 112 C 168 70, 148 44, 136 30 Z" fill="white"/>
                <path d="M 158 232 C 176 206, 212 200, 228 218 C 242 236, 233 266, 213 275 C 193 284, 168 272, 162 252 C 158 236, 158 216, 158 232 Z" fill="white"/>
              </g>
            </svg>
          </div>
          {/* ポップアップ */}
          {headerExpanded && (
            <div
              onClick={() => setHeaderExpanded(false)}
              className="absolute top-0 left-12"
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 8,
                boxShadow: '0 2px 6px rgba(0,0,0,0.25), 0 8px 20px rgba(0,0,0,0.15)',
                padding: '6px 12px',
                minWidth: 260,
              }}
            >
              <p className="text-sm font-medium text-black" style={{ whiteSpace: 'nowrap' }}>
                太田市おでかけマップ
              </p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                今週末、子どもとどこ行く？<br />家族で楽しめるイベントを地図で発見！
              </p>
            </div>
          )}
        </div>

        {adminButton('bottom-[88px]')}
        <BottomSheet
          spotCount={filteredSpots.length}
          expanded={sheetExpanded}
          onExpandedChange={setSheetExpanded}
        >
          <Sidebar {...sidebarProps} mode="sheet" />
        </BottomSheet>
        {detailSpot && (
          <div className="fixed inset-0 z-[1001]">
            <DetailPanel spot={detailSpot} onClose={handleDetailClose} mobile />
          </div>
        )}
      </div>
    )
  }

  /* ── デスクトップレイアウト ── */
  return (
    <div className="flex h-full">
      <Sidebar {...sidebarProps} mode="sidebar" />
      {detailSpot && (
        <DetailPanel spot={detailSpot} onClose={handleDetailClose} />
      )}
      <main className="flex-1 relative">
        <MapView
          spots={filteredSpots}
          selectedSpot={selectedSpot}
          onSpotSelect={setSelectedSpot}
          onDetailOpen={handleDetailOpen}
          onDetailClose={handleDetailClose}
          detailPanelOpen={detailSpot !== null}
          userLocation={userLocation}
          locationRadius={locationRadius}
        />
        {adminButton('bottom-6')}
      </main>
    </div>
  )
}
