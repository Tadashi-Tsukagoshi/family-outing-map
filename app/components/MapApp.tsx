'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Sidebar from './Sidebar'
import DetailPanel from './DetailPanel'
import BottomSheet from './BottomSheet'
import { SPOTS, CATEGORY_LABELS, type Category, type Spot } from '@/lib/spots'
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

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const [weekendOnly, setWeekendOnly] = useState(false)
  const [activeCategories, setActiveCategories] = useState<Set<Category>>(
    () => new Set(Object.keys(CATEGORY_LABELS) as Category[])
  )
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null)
  const [detailSpot,   setDetailSpot]   = useState<Spot | null>(null)
  const [collectedSpots, setCollectedSpots] = useState<Spot[]>([])
  const [hiddenSpotIds, setHiddenSpotIds]   = useState<Set<string>>(new Set())
  const [overrideIds,   setOverrideIds]     = useState<Set<string>>(new Set())
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
      setHiddenSpotIds(new Set(db.hiddenSpotIds ?? []))
      setOverrideIds(new Set(db.events.map(e => e.id)))
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

  const allSpots = useMemo(() => [
    ...SPOTS.filter(s => !hiddenSpotIds.has(s.id) && !overrideIds.has(s.id)),
    ...collectedSpots,
  ], [collectedSpots, hiddenSpotIds, overrideIds])

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
    onLocate: handleLocate,
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
        {adminButton('bottom-[88px]')}
        <BottomSheet spotCount={filteredSpots.length}>
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
