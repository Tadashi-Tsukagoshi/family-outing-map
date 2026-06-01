'use client'

import { useState, useEffect } from 'react'
import { SPOTS, CATEGORY_LABELS, CATEGORY_EMOJIS, type Spot } from '@/lib/spots'
import { eventToSpot, type EventsDatabase } from '@/lib/events'
import { getEventStatus, fmtDateRange } from '@/lib/date-utils'

const POSTER_TYPE_LABELS: Record<string, string> = {
  general:   '一般ユーザー',
  organizer: '主催者',
  business:  '事業者',
  staff:     '運営',
}

export default function EndedEventsPage() {
  const [endedSpots, setEndedSpots] = useState<Spot[]>([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/events')
        const db: EventsDatabase = await res.json()
        const hiddenSet   = new Set(db.hiddenSpotIds ?? [])
        const overrideIds = new Set(db.events.map(e => e.id))

        const fromFixed = SPOTS
          .filter(s => !hiddenSet.has(s.id) && !overrideIds.has(s.id))
          .filter(s => getEventStatus(s.startDate, s.endDate) === 'ended')

        const fromCollected = db.events
          .map(eventToSpot)
          .filter(s => getEventStatus(s.startDate, s.endDate) === 'ended')

        const all = [...fromFixed, ...fromCollected]
        all.sort((a, b) => (b.endDate ?? '').localeCompare(a.endDate ?? ''))
        setEndedSpots(all)
      } catch {
        setEndedSpots([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <a href="/" className="text-gray-400 hover:text-gray-600 text-sm">← 地図に戻る</a>
        <span className="text-gray-300">|</span>
        <h1 className="text-base font-bold text-gray-800">終了イベント</h1>
      </header>

      <main className="max-w-xl mx-auto px-4 py-8">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-12">読み込み中...</p>
        ) : endedSpots.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">終了したイベントはありません。</p>
        ) : (
          <ul className="space-y-3">
            {endedSpots.map(spot => (
              <li key={spot.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                <div className="flex items-start gap-3">
                  <span className="text-xl mt-0.5 flex-shrink-0">
                    {CATEGORY_EMOJIS[spot.category]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700">{spot.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {fmtDateRange(spot.startDate, spot.endDate) ?? '日程不明'}
                      {spot.venue ? ` · ${spot.venue}` : ''}
                    </p>
                    {spot.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{spot.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">
                        {CATEGORY_LABELS[spot.category]}
                      </span>
                      {spot.posterType && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">
                          {POSTER_TYPE_LABELS[spot.posterType] ?? spot.posterType}
                        </span>
                      )}
                      {spot.postedBy && (
                        <span className="text-[10px] text-gray-400">👤 {spot.postedBy}</span>
                      )}
                    </div>
                  </div>
                  {spot.url && (
                    <a
                      href={spot.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-600 flex-shrink-0 mt-0.5"
                    >
                      ↗
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
