'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'

type Period = 'all' | '30d' | '7d'

type Overview = {
  totalViews: number
  uniqueVisitors: number | null
  eventCount: number
  dateRangeLabel: string
}

type RankingItem = {
  eventId: string
  name: string
  category: string
  categoryLabel: string
  city: string | null
  viewCount: number
  imageCount: number
  descriptionLength: number
  status: string | null
  statusLabel: string
  startDate: string | null
  url: string
}

type CategoryStat = {
  category: string
  label: string
  eventCount: number
  totalViews: number
  avgViews: number
  medianViews: number
}

type BucketStat = { bucket: string; eventCount: number; avgViews: number }
type TypeStat = { type: string; eventCount: number; avgViews: number }
type AreaStat = { city: string; eventCount: number; avgViews: number }

type SummaryResponse = {
  overview: Overview
  ranking: RankingItem[]
  byCategory: CategoryStat[]
  byImageCount: BucketStat[]
  byDescriptionLength: BucketStat[]
  byType: TypeStat[]
  byArea: AreaStat[]
}

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'all', label: '全期間' },
  { value: '30d', label: '直近30日' },
  { value: '7d',  label: '直近7日' },
]

const TYPE_LABELS: Record<string, string> = {
  event:      'イベント',
  event_plus: 'イベント＋',
}

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  active:    { bg: '#dcfce7', color: '#16a34a' },
  ended:     { bg: '#f3f4f6', color: '#9ca3af' },
  upcoming:  { bg: '#eff6ff', color: '#3b82f6' },
  scheduled: { bg: '#faf5ff', color: '#9333ea' },
}

function fmt1(n: number): string {
  return n.toFixed(1)
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">{title}</h2>
      {children}
    </section>
  )
}

function BarRow({ label, value, maxValue, sub }: { label: string; value: number; maxValue: number; sub?: string }) {
  const pct = maxValue > 0 ? Math.max(2, Math.round((value / maxValue) * 100)) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="w-32 shrink-0 text-xs text-gray-600 truncate" title={label}>{label}</div>
      <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <div className="w-24 shrink-0 text-xs font-semibold text-gray-700 text-right">
        {fmt1(value)}
        {sub && <span className="ml-1 text-[10px] font-normal text-gray-400">{sub}</span>}
      </div>
    </div>
  )
}

type SortDir = 'desc' | 'asc'

export default function AnalyticsContent() {
  const [period, setPeriod] = useState<Period>('all')
  const [includeEnded, setIncludeEnded] = useState(true)
  const [data, setData] = useState<SummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const load = useCallback(async (p: Period, ie: boolean) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/analytics/summary?period=${p}&include_ended=${ie}`)
      if (!res.ok) throw new Error('取得に失敗しました')
      const json = await res.json() as SummaryResponse
      setData(json)
    } catch {
      setError('データの取得に失敗しました。時間を置いて再度お試しください。')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(period, includeEnded)
  }, [period, includeEnded, load])

  const sortedRanking = useMemo(() => {
    if (!data) return []
    return [...data.ranking].sort((a, b) => (
      sortDir === 'desc'
        ? b.viewCount - a.viewCount || a.name.localeCompare(b.name, 'ja')
        : a.viewCount - b.viewCount || a.name.localeCompare(b.name, 'ja')
    ))
  }, [data, sortDir])

  const maxCategoryAvg = data ? Math.max(0, ...data.byCategory.map(c => c.avgViews)) : 0
  const maxImageAvg    = data ? Math.max(0, ...data.byImageCount.map(c => c.avgViews)) : 0
  const maxDescAvg     = data ? Math.max(0, ...data.byDescriptionLength.map(c => c.avgViews)) : 0
  const maxTypeAvg     = data ? Math.max(0, ...data.byType.map(c => c.avgViews)) : 0
  const maxAreaAvg     = data ? Math.max(0, ...data.byArea.map(c => c.avgViews)) : 0

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3 flex-wrap">
        <a href="/ota-admin" className="text-gray-400 hover:text-gray-600 text-sm">← 管理画面に戻る</a>
        <span className="text-gray-300">|</span>
        <h1 className="text-base font-bold text-gray-800">アクセス分析</h1>

        <div className="ml-auto flex items-center gap-3 flex-wrap">
          <select
            value={period}
            onChange={e => setPeriod(e.target.value as Period)}
            className="text-xs rounded-lg border border-gray-300 px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {PERIOD_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={includeEnded}
              onChange={e => setIncludeEnded(e.target.checked)}
              className="cursor-pointer"
            />
            終了イベントを含む
          </label>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <p className="text-xs text-gray-500 bg-yellow-50 border border-yellow-200 rounded p-3">
          ※ 2026-09-19以前のPVはVercel Analyticsによる集計（SEO・外部リンク経由）、
          以降は自前計測（アプリ内クリック含む全アクセス）です。
          カットオーバー前後で計測範囲が異なるため、期間をまたぐ比較時はご留意ください。
        </p>

        {loading && (
          <div className="text-center text-sm text-gray-400 py-12">読み込み中...</div>
        )}

        {!loading && error && (
          <div className="text-center text-sm text-red-500 py-12">{error}</div>
        )}

        {!loading && !error && data && (
          <>
            {/* 概要カード */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <div className="text-xs text-gray-500 mb-1">総PV</div>
                <div className="text-2xl font-bold text-gray-800">{data.overview.totalViews.toLocaleString()}</div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <div className="text-xs text-gray-500 mb-1">対象イベント数</div>
                <div className="text-2xl font-bold text-gray-800">{data.overview.eventCount.toLocaleString()}</div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <div className="text-xs text-gray-500 mb-1">集計期間</div>
                <div className="text-2xl font-bold text-gray-800">{data.overview.dateRangeLabel}</div>
              </div>
            </div>

            {/* イベント別PVランキング */}
            <Card title="イベント別PVランキング">
              {sortedRanking.length === 0 ? (
                <p className="text-xs text-gray-400">対象データがありません。</p>
              ) : (
                <div className="max-h-[70vh] overflow-y-auto overflow-x-auto -mx-6 px-6">
                  <table className="w-full text-xs border-collapse min-w-[720px]">
                    <thead>
                      <tr className="text-gray-500 border-b border-gray-100">
                        <th className="sticky top-0 bg-white z-10 text-left font-medium py-2 pr-2 w-10">順位</th>
                        <th className="sticky top-0 bg-white z-10 text-left font-medium py-2 pr-2">イベント名</th>
                        <th className="sticky top-0 bg-white z-10 text-left font-medium py-2 pr-2">カテゴリ</th>
                        <th className="sticky top-0 bg-white z-10 text-left font-medium py-2 pr-2">エリア</th>
                        <th className="sticky top-0 bg-white z-10 text-right font-medium py-2 pr-2">
                          <button
                            type="button"
                            onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                            className="inline-flex items-center gap-0.5 cursor-pointer hover:text-gray-800"
                          >
                            PV
                            <span aria-hidden="true">{sortDir === 'desc' ? '↓' : '↑'}</span>
                          </button>
                        </th>
                        <th className="sticky top-0 bg-white z-10 text-right font-medium py-2 pr-2">画像</th>
                        <th className="sticky top-0 bg-white z-10 text-right font-medium py-2 pr-2">説明文字数</th>
                        <th className="sticky top-0 bg-white z-10 text-left font-medium py-2 pl-2">ステータス</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRanking.map((item, idx) => {
                        const badge = item.status ? STATUS_BADGE[item.status] : { bg: '#f3f4f6', color: '#9ca3af' }
                        return (
                          <tr key={item.eventId} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 pr-2 text-gray-400">{idx + 1}</td>
                            <td className="py-2 pr-2 max-w-[220px]">
                              <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate block">
                                {item.name}
                              </a>
                            </td>
                            <td className="py-2 pr-2 text-gray-600 whitespace-nowrap">{item.categoryLabel}</td>
                            <td className="py-2 pr-2 text-gray-600 whitespace-nowrap">{item.city ?? '-'}</td>
                            <td className="py-2 pr-2 text-right font-bold text-gray-800">{item.viewCount}</td>
                            <td className="py-2 pr-2 text-right text-gray-600">{item.imageCount}</td>
                            <td className="py-2 pr-2 text-right text-gray-600">{item.descriptionLength}</td>
                            <td className="py-2 pl-2 whitespace-nowrap">
                              <span
                                className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                style={{ background: badge.bg, color: badge.color }}
                              >
                                {item.statusLabel}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              {/* カテゴリ別集計 */}
              <Card title="カテゴリ別（平均PV）">
                <div className="space-y-3">
                  {data.byCategory.map(c => (
                    <BarRow key={c.category} label={`${c.label}（${c.eventCount}件）`} value={c.avgViews} maxValue={maxCategoryAvg} sub={`中央値${fmt1(c.medianViews)}`} />
                  ))}
                </div>
              </Card>

              {/* イベントタイプ別 */}
              <Card title="イベントタイプ別（平均PV）">
                <div className="space-y-3">
                  {data.byType.map(t => (
                    <BarRow key={t.type} label={`${TYPE_LABELS[t.type] ?? t.type}（${t.eventCount}件）`} value={t.avgViews} maxValue={maxTypeAvg} />
                  ))}
                </div>
              </Card>

              {/* 画像枚数と平均PV */}
              <Card title="画像枚数と平均PVの関係">
                <div className="space-y-3">
                  {data.byImageCount.map(b => (
                    <BarRow key={b.bucket} label={`${b.bucket}（${b.eventCount}件）`} value={b.avgViews} maxValue={maxImageAvg} />
                  ))}
                </div>
              </Card>

              {/* 説明文の充実度と平均PV */}
              <Card title="説明文の充実度と平均PVの関係">
                <div className="space-y-3">
                  {data.byDescriptionLength.map(b => (
                    <BarRow key={b.bucket} label={`${b.bucket}（${b.eventCount}件）`} value={b.avgViews} maxValue={maxDescAvg} />
                  ))}
                </div>
              </Card>
            </div>

            {/* エリア別集計 */}
            <Card title="エリア別集計（登録数上位20市）">
              {data.byArea.length === 0 ? (
                <p className="text-xs text-gray-400">対象データがありません。</p>
              ) : (
                <div className="space-y-3">
                  {data.byArea.map(a => (
                    <BarRow key={a.city} label={`${a.city}（${a.eventCount}件）`} value={a.avgViews} maxValue={maxAreaAvg} />
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </main>
    </div>
  )
}
