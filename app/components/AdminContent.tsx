'use client'

import { useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { CATEGORY_LABELS, CATEGORY_EMOJIS, type Category } from '@/lib/spots'
import type { CollectedEvent } from '@/lib/events'

const MapPicker = dynamic(() => import('./MapPicker'), { ssr: false })

// ─── 型 ───────────────────────────────────────────────────────────
type PosterType = 'general' | 'organizer' | 'business' | 'staff'

type FormState = {
  name:          string
  category:      Category
  dateConfirmed: boolean
  startDate:     string
  endDate:       string
  scheduleNote:  string
  venue:         string
  address:       string
  lat:           number | null
  lng:           number | null
  description:   string
  url:           string
  postedBy:      string
  posterType:    PosterType
}

type GeoStatus    = 'idle' | 'loading' | 'ok' | 'error'
type SubmitStatus = 'idle' | 'loading' | 'ok' | 'error'

const POSTER_TYPE_LABELS: Record<string, string> = {
  general:   '一般ユーザー',
  organizer: '主催者',
  business:  '事業者',
  staff:     'サイト管理者',
}

const INITIAL: FormState = {
  name: '', category: 'event',
  dateConfirmed: true,
  startDate: '', endDate: '', scheduleNote: '',
  venue: '', address: '',
  lat: null, lng: null,
  description: '', url: '',
  postedBy: '', posterType: 'general',
}

type Props = {
  posterTypeOptions?: { value: PosterType; label: string }[]
  fixedPosterType?: PosterType
  onLogout?: () => void
}

// ─── ユーティリティ ────────────────────────────────────────────────
function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
        placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400
        disabled:bg-gray-50 disabled:text-gray-500 ${props.className ?? ''}`}
    />
  )
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
        placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400
        resize-y disabled:bg-gray-50 ${props.className ?? ''}`}
    />
  )
}


function formatDateRange(ev: CollectedEvent) {
  if (ev.scheduleNote) return ev.scheduleNote
  const start = ev.startDate ?? ev.date ?? ''
  const end   = ev.endDate   ?? ev.date ?? ''
  if (!start && !end) return '日程未定'
  if (start === end)  return start
  return `${start} 〜 ${end}`
}

// ─── 管理画面本体 ──────────────────────────────────────────────────
export default function AdminContent({ posterTypeOptions, fixedPosterType, onLogout }: Props) {
  const [form, setForm]                   = useState<FormState>({
    ...INITIAL,
    posterType: fixedPosterType ?? 'general',
  })
  const [geoStatus,    setGeoStatus]      = useState<GeoStatus>('idle')
  const [geoMessage,   setGeoMessage]     = useState('')
  const [submitStatus, setSubmitStatus]   = useState<SubmitStatus>('idle')
  const [submitMessage, setSubmitMessage] = useState('')
  const [editingId,    setEditingId]      = useState<string | null>(null)
  const [showMapPicker, setShowMapPicker] = useState(false)

  const [events,        setEvents]        = useState<CollectedEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const geoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const formRef  = useRef<HTMLFormElement>(null)

  const loadEvents = async () => {
    setEventsLoading(true)
    try {
      const res  = await fetch('/api/events')
      const data = await res.json()
      setEvents(data.events ?? [])
    } catch {
      setEvents([])
    } finally {
      setEventsLoading(false)
    }
  }

  useEffect(() => { loadEvents() }, [])

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm(f => ({ ...f, [key]: val }))

  const geocode = async (address: string) => {
    if (!address.trim()) return
    setGeoStatus('loading')
    setGeoMessage('住所を検索中...')
    try {
      const res  = await fetch(`/api/geocode?q=${encodeURIComponent(address + ' 日本')}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '取得失敗')
      setForm(f => ({ ...f, lat: data.lat, lng: data.lng }))
      setGeoStatus('ok')
      setGeoMessage(`📍 ${data.display_name}`)
    } catch (e) {
      setGeoStatus('error')
      setGeoMessage(e instanceof Error ? e.message : '住所が見つかりませんでした')
      setForm(f => ({ ...f, lat: null, lng: null }))
    }
  }

  const onAddressChange = (v: string) => {
    set('address', v)
    setGeoStatus('idle')
    setGeoMessage('')
    if (geoTimer.current) clearTimeout(geoTimer.current)
    if (v.trim().length >= 4) {
      geoTimer.current = setTimeout(() => geocode(v), 700)
    }
  }

  const handleEdit = (ev: CollectedEvent) => {
    setEditingId(ev.id)
    const hasScheduleNote = !!ev.scheduleNote
    setForm({
      name:          ev.name,
      category:      ev.category ?? 'event',
      dateConfirmed: !hasScheduleNote,
      startDate:     ev.startDate ?? ev.date ?? '',
      endDate:       ev.endDate   ?? ev.date ?? '',
      scheduleNote:  ev.scheduleNote ?? '',
      venue:         ev.venue,
      address:       '',
      lat:           ev.lat,
      lng:           ev.lng,
      description:   ev.description,
      url:           ev.url ?? '',
      postedBy:      ev.postedBy  ?? '',
      posterType:    fixedPosterType ?? (ev.posterType as PosterType) ?? 'general',
    })
    setGeoStatus('ok')
    setGeoMessage('📍 既存の位置情報を使用中（住所を入力して「取得」を押すと更新できます）')
    setSubmitStatus('idle')
    setSubmitMessage('')
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setForm({ ...INITIAL, posterType: fixedPosterType ?? 'general' })
    setGeoStatus('idle')
    setGeoMessage('')
    setSubmitStatus('idle')
    setSubmitMessage('')
    setShowMapPicker(false)
  }

  const handleDelete = async (ev: CollectedEvent) => {
    if (!window.confirm(`「${ev.name}」を削除しますか？`)) return
    try {
      const res = await fetch(`/api/events/${ev.id}`, { method: 'DELETE' })
      if (!res.ok) {
        let data: Record<string, unknown> = {}
        try { data = await res.json() } catch { /* empty body */ }
        throw new Error((data.error as string | undefined) ?? '削除に失敗しました')
      }
      if (editingId === ev.id) handleCancelEdit()
      await loadEvents()
    } catch (e) {
      alert(e instanceof Error ? e.message : '削除に失敗しました')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.lat === null || form.lng === null) {
      setSubmitStatus('error')
      setSubmitMessage('住所から緯度経度を取得してください。')
      return
    }
    setSubmitStatus('loading')
    setSubmitMessage('')
    try {
      const url    = editingId ? `/api/events/${editingId}` : '/api/register-event'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
        ...form,
        scheduleNote: form.dateConfirmed ? '' : form.scheduleNote,
        startDate:    form.dateConfirmed ? form.startDate : '',
        endDate:      form.dateConfirmed ? form.endDate   : '',
      }),
      })
      let data: Record<string, unknown> = {}
      try {
        data = await res.json()
      } catch {
        throw new Error(editingId ? '更新に失敗しました（サーバーエラー）' : '登録に失敗しました（サーバーエラー）')
      }
      if (!res.ok) throw new Error((data.error as string | undefined) ?? (editingId ? '更新に失敗しました' : '登録に失敗しました'))
      setSubmitStatus('ok')
      const eventName = (data.event as { name?: string } | undefined)?.name ?? form.name
      setSubmitMessage(editingId
        ? `「${eventName}」を更新しました！`
        : `「${eventName}」を登録しました！`)
      setForm(INITIAL)
      setEditingId(null)
      setGeoStatus('idle')
      setGeoMessage('')
      setShowMapPicker(false)
      await loadEvents()
    } catch (e) {
      setSubmitStatus('error')
      setSubmitMessage(e instanceof Error ? e.message : (editingId ? '更新に失敗しました' : '登録に失敗しました'))
    }
  }

  const isSubmitting = submitStatus === 'loading'
  const categories   = Object.keys(CATEGORY_LABELS) as Category[]

  const allItems = events

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <a href="/" className="text-gray-400 hover:text-gray-600 text-sm">← 地図に戻る</a>
        <span className="text-gray-300">|</span>
        <h1 className="text-base font-bold text-gray-800">イベント管理</h1>
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="ml-auto text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            ログアウト
          </button>
        )}
      </header>

      <main className="max-w-xl mx-auto px-4 py-8 space-y-8">

        {/* 登録 / 編集フォーム */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            {editingId ? 'イベントを編集' : 'イベントを新規登録'}
          </h2>
          <form ref={formRef} onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">

            {editingId && (
              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
                <span className="text-xs text-blue-700 font-medium">編集モード</span>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-xs text-blue-500 hover:text-blue-700 cursor-pointer"
                >
                  キャンセル
                </button>
              </div>
            )}

            {/* イベント名 */}
            <div>
              <Label required>イベント名</Label>
              <Input
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="例：太田ものづくりフェア2026"
                required
                disabled={isSubmitting}
              />
            </div>

            {/* カテゴリ */}
            <div>
              <Label required>カテゴリ</Label>
              <div className="grid grid-cols-5 gap-2">
                {categories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => set('category', cat)}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer
                      ${form.category === cat
                        ? 'border-green-400 bg-green-50 text-green-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                  >
                    <span className="text-lg">{CATEGORY_EMOJIS[cat]}</span>
                    {CATEGORY_LABELS[cat].replace('・', '・\n')}
                  </button>
                ))}
              </div>
            </div>

            {/* 日程確定トグル */}
            <div>
              <Label required>日程</Label>
              <div className="flex gap-2 mb-3">
                {([true, false] as const).map(confirmed => (
                  <button
                    key={String(confirmed)}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => set('dateConfirmed', confirmed)}
                    className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-colors cursor-pointer
                      ${form.dateConfirmed === confirmed
                        ? 'border-green-400 bg-green-50 text-green-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                  >
                    {confirmed ? '日程確定' : '日程未定'}
                  </button>
                ))}
              </div>

              {form.dateConfirmed ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label required>開始日</Label>
                    <Input
                      type="date"
                      value={form.startDate}
                      onChange={e => set('startDate', e.target.value)}
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <Label required>終了日</Label>
                    <Input
                      type="date"
                      value={form.endDate}
                      min={form.startDate}
                      onChange={e => set('endDate', e.target.value)}
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <Label>開始日</Label>
                      <Input type="date" value="" disabled className="opacity-40" />
                    </div>
                    <div>
                      <Label>終了日</Label>
                      <Input type="date" value="" disabled className="opacity-40" />
                    </div>
                  </div>
                  <div>
                    <Label required>開催予定時期</Label>
                    <Input
                      value={form.scheduleNote}
                      onChange={e => set('scheduleNote', e.target.value)}
                      placeholder="例：7月下旬頃"
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                </>
              )}
            </div>

            {/* 会場名 */}
            <div>
              <Label required>会場名</Label>
              <Input
                value={form.venue}
                onChange={e => set('venue', e.target.value)}
                placeholder="例：太田市総合体育館"
                required
                disabled={isSubmitting}
              />
            </div>

            {/* 住所 + ジオコーディング */}
            <div>
              <Label required={!editingId}>住所</Label>
              <p className="text-xs text-gray-400 mb-1">
                {editingId
                  ? '住所を入力して「取得」を押すと位置情報を更新できます。'
                  : '都道府県から入力すると精度が上がります。入力後に自動取得、または「取得」ボタンを押してください。'}
              </p>
              <div className="flex gap-2">
                <Input
                  value={form.address}
                  onChange={e => onAddressChange(e.target.value)}
                  placeholder="例：群馬県太田市飯塚町1059-1"
                  disabled={isSubmitting}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => geocode(form.address)}
                  disabled={!form.address.trim() || geoStatus === 'loading' || isSubmitting}
                  className="flex-shrink-0 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-600
                    hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  {geoStatus === 'loading' ? '…' : '取得'}
                </button>
              </div>

              {geoMessage && (
                <p className={`mt-1.5 text-xs leading-snug
                  ${geoStatus === 'ok'      ? 'text-green-600' : ''}
                  ${geoStatus === 'error'   ? 'text-red-500'   : ''}
                  ${geoStatus === 'loading' ? 'text-gray-400'  : ''}`}>
                  {geoMessage}
                </p>
              )}

              {form.lat !== null && form.lng !== null && (
                <div className="mt-2 flex gap-2">
                  <div className="flex-1">
                    <span className="text-[10px] text-gray-400 block mb-0.5">緯度</span>
                    <Input value={form.lat.toFixed(6)} readOnly className="bg-gray-50 text-gray-500 text-xs" />
                  </div>
                  <div className="flex-1">
                    <span className="text-[10px] text-gray-400 block mb-0.5">経度</span>
                    <Input value={form.lng.toFixed(6)} readOnly className="bg-gray-50 text-gray-500 text-xs" />
                  </div>
                </div>
              )}

              {/* 地図ピッカー */}
              <button
                type="button"
                onClick={() => setShowMapPicker(v => !v)}
                disabled={isSubmitting}
                className="mt-2 text-xs text-blue-500 hover:text-blue-700 disabled:opacity-40 cursor-pointer"
              >
                {showMapPicker ? '▲ 地図を閉じる' : '▼ 地図でピンを直接指定する'}
              </button>
              {showMapPicker && (
                <div className="mt-2">
                  <p className="text-xs text-gray-400 mb-1.5">地図をクリック、またはピンをドラッグして位置を指定してください。</p>
                  <MapPicker
                    key={showMapPicker ? 'open' : 'closed'}
                    lat={form.lat}
                    lng={form.lng}
                    onChange={(lat, lng) => {
                      setForm(f => ({ ...f, lat, lng }))
                      setGeoStatus('ok')
                      setGeoMessage(`📍 地図でピンを指定しました（${lat.toFixed(5)}, ${lng.toFixed(5)}）`)
                    }}
                  />
                </div>
              )}
            </div>

            {/* 説明文 */}
            <div>
              <Label>説明文</Label>
              <Textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="イベントの内容を簡潔に（100文字程度）"
                rows={3}
                disabled={isSubmitting}
              />
            </div>

            {/* URL */}
            <div>
              <Label>公式 URL</Label>
              <Input
                type="url"
                value={form.url}
                onChange={e => set('url', e.target.value)}
                placeholder="https://example.com/event"
                disabled={isSubmitting}
              />
            </div>

            {/* ニックネーム */}
            <div>
              <Label required>ニックネーム・ハンドルネーム</Label>
              <Input
                value={form.postedBy}
                onChange={e => set('postedBy', e.target.value)}
                placeholder="例：太田っ子、匿名　など"
                required
                disabled={isSubmitting}
              />
            </div>

            {/* 投稿者種別 */}
            <div>
              <Label required>投稿者種別</Label>
              <div className="flex gap-2">
                {fixedPosterType ? (
                  <button
                    type="button"
                    disabled
                    className="flex-1 py-2 rounded-xl border text-sm font-medium border-green-400 bg-green-50 text-green-700 cursor-default"
                  >
                    {POSTER_TYPE_LABELS[fixedPosterType] ?? fixedPosterType}
                  </button>
                ) : (
                  posterTypeOptions?.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => set('posterType', opt.value)}
                      className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-colors cursor-pointer
                        ${form.posterType === opt.value
                          ? 'border-green-400 bg-green-50 text-green-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                    >
                      {opt.label}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* 送信結果 */}
            {submitMessage && (
              <div className={`rounded-xl px-4 py-3 text-sm
                ${submitStatus === 'ok'    ? 'bg-green-50 text-green-700 border border-green-200' : ''}
                ${submitStatus === 'error' ? 'bg-red-50   text-red-600   border border-red-200'   : ''}`}>
                {submitMessage}
              </div>
            )}

            {/* 送信ボタン */}
            <button
              type="submit"
              disabled={isSubmitting || !form.name || !form.venue ||
                (form.dateConfirmed ? (!form.startDate || !form.endDate) : !form.scheduleNote)}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-colors cursor-pointer
                bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isSubmitting
                ? (editingId ? '更新中...' : '登録中...')
                : (editingId ? '上書き保存' : 'イベントを登録する')}
            </button>
          </form>
        </section>

        {/* 登録済みイベント一覧 */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">登録済みイベント</h2>
          {eventsLoading ? (
            <p className="text-sm text-gray-400">読み込み中...</p>
          ) : allItems.length === 0 ? (
            <p className="text-sm text-gray-400">登録されたイベントはありません。</p>
          ) : (
            <ul className="space-y-2">
              {allItems.map(ev => (
                <li
                  key={ev.id}
                  className={`bg-white rounded-xl border px-4 py-3 flex items-start gap-3 transition-colors
                    ${editingId === ev.id ? 'border-blue-300 bg-blue-50' : 'border-gray-100'}`}
                >
                  <span className="text-xl mt-0.5 flex-shrink-0">
                    {CATEGORY_EMOJIS[ev.category ?? 'event']}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{ev.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{formatDateRange(ev)} · {ev.venue}</p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleEdit(ev)}
                      className="px-2.5 py-1 text-xs rounded-lg border border-blue-200 text-blue-600
                        hover:bg-blue-100 transition-colors cursor-pointer"
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(ev)}
                      className="px-2.5 py-1 text-xs rounded-lg border border-red-200 text-red-500
                        hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      削除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

      </main>


    </div>
  )
}
