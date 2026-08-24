'use client'

import { useState, useRef, useEffect } from 'react'
import { CategoryIcon } from './Sidebar'
import EventFormFields, { type FormState, type PosterType, INITIAL_FORM, eventToFormState } from './EventFormFields'
import PendingEventCard from './PendingEventCard'
import DuplicateEventModal from './DuplicateEventModal'
import { formatDateRange, type CollectedEvent } from '@/lib/events'
import { CATEGORY_LABELS, type Category, type EventDateEntry } from '@/lib/spots'
import { getEventStatus } from '@/lib/date-utils'

/** event_plus の複数日程から「最も近い次回開催日」を選び、イベント本体の start_date/end_date に使う（ピンのステータス判定用） */
function pickNearestEventDate(dates: EventDateEntry[]): { startDate: string; endDate: string } | null {
  const valid = dates.filter(d => d.startDate && d.endDate)
  if (valid.length === 0) return null
  const todayStr = new Date().toISOString().split('T')[0]
  const upcoming = valid
    .filter(d => d.endDate >= todayStr)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
  if (upcoming.length > 0) return { startDate: upcoming[0].startDate, endDate: upcoming[0].endDate }
  const past = [...valid].sort((a, b) => b.endDate.localeCompare(a.endDate))
  return { startDate: past[0].startDate, endDate: past[0].endDate }
}

// ─── 型 ───────────────────────────────────────────────────────────
type SubmitStatus = 'idle' | 'loading' | 'ok' | 'error'

type Props = {
  posterTypeOptions?: { value: PosterType; label: string }[]
  fixedPosterType?: PosterType
  onLogout?: () => void
  /** true の場合、localStorage "myEvents" に記録された自分の投稿にのみ編集・削除ボタンを表示し、
   *  PUT/DELETE リクエストに x-edit-token ヘッダを付与する（一般公開の /admin 用） */
  restrictEditToOwn?: boolean
  /** true の場合、承認待ちスポットの承認・却下セクションを表示する（運営用の /ota-admin 用） */
  showApprovalSection?: boolean
  /** true の場合、「登録済みスポット一覧」セクションを非表示にする（一般公開の /admin 用） */
  hideEventList?: boolean
  /** true の場合、投稿が承認制であることを投稿前・投稿後に案内する（一般公開の /admin 用） */
  showApprovalNotice?: boolean
  /** true の場合、メールアドレス（任意）入力欄を表示する（一般公開の /admin 用） */
  showEmail?: boolean
}

// ─── 自分の投稿（編集トークン）の localStorage 管理 ──────────────────
const MY_EVENTS_KEY = 'myEvents'

type MyEvent = { id: string; token: string }

function readMyEvents(): MyEvent[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(MY_EVENTS_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function appendMyEvent(id: string, token: string): MyEvent[] {
  const next = [...readMyEvents(), { id, token }]
  try { localStorage.setItem(MY_EVENTS_KEY, JSON.stringify(next)) } catch { /* noop */ }
  return next
}

// ─── 管理画面本体 ──────────────────────────────────────────────────
export default function AdminContent({ posterTypeOptions, fixedPosterType, onLogout, restrictEditToOwn, showApprovalSection, hideEventList, showApprovalNotice, showEmail }: Props) {
  const getInitialPosterType = () => fixedPosterType ?? posterTypeOptions?.[0]?.value ?? 'general'
  const [form, setForm]                   = useState<FormState>({ ...INITIAL_FORM, posterType: getInitialPosterType() })
  const [submitStatus, setSubmitStatus]   = useState<SubmitStatus>('idle')
  const [submitMessage, setSubmitMessage] = useState('')
  const [editingId,    setEditingId]      = useState<string | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
  /** editingId が同じでもフォームを作り直したい時（新規登録直後・編集キャンセル時）に変更するキー */
  const [formInstanceKey, setFormInstanceKey] = useState(0)

  const [events,        setEvents]        = useState<CollectedEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [searchQuery,   setSearchQuery]   = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [listMinHeight, setListMinHeight] = useState<number | undefined>(undefined)
  const listContainerRef = useRef<HTMLDivElement>(null)
  const [myEvents,      setMyEvents]      = useState<MyEvent[]>([])
  const [pendingEvents,   setPendingEvents]   = useState<CollectedEvent[]>([])
  const [pendingLoading,  setPendingLoading]  = useState(true)
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)
  const [expandedPendingId, setExpandedPendingId] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [duplicatingImage, setDuplicatingImage] = useState(false)

  useEffect(() => {
    if (restrictEditToOwn) setMyEvents(readMyEvents())
  }, [restrictEditToOwn])

  const getEditToken = (id: string) => myEvents.find(m => m.id === id)?.token
  const isMyEvent    = (id: string) => myEvents.some(m => m.id === id)

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

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    if (debouncedQuery.trim() === '') {
      const height = listContainerRef.current?.offsetHeight
      if (height) setListMinHeight(height)
    }
  }, [debouncedQuery, events])

  const loadPendingEvents = async () => {
    setPendingLoading(true)
    try {
      const res  = await fetch('/api/events/pending')
      const data = await res.json()
      setPendingEvents(data.events ?? [])
    } catch {
      setPendingEvents([])
    } finally {
      setPendingLoading(false)
    }
  }

  useEffect(() => {
    if (showApprovalSection) loadPendingEvents()
  }, [showApprovalSection])

  const handleRejectPending = async (ev: CollectedEvent) => {
    setPendingActionId(ev.id)
    try {
      const res = await fetch(`/api/events/${ev.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data.error as string | undefined) ?? '却下に失敗しました')
      }
      setPendingEvents(prev => prev.filter(e => e.id !== ev.id))
    } catch (e) {
      alert(e instanceof Error ? e.message : '却下に失敗しました')
    } finally {
      setPendingActionId(null)
    }
  }

  const handleApprovePending = async (ev: CollectedEvent, formValues: FormState) => {
    if (formValues.lat === null || formValues.lng === null) {
      alert('住所から緯度経度を取得してください。')
      return
    }
    setPendingActionId(ev.id)
    try {
      const isPermanent = formValues.type === 'permanent'
      const putRes = await fetch(`/api/events/${ev.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formValues,
          scheduleNote: isPermanent ? '' : (formValues.dateConfirmed ? '' : formValues.scheduleNote),
          startDate:    isPermanent ? '' : (formValues.dateConfirmed ? formValues.startDate : ''),
          endDate:      isPermanent ? '' : (formValues.dateConfirmed ? formValues.endDate   : ''),
        }),
      })
      if (!putRes.ok) {
        const data = await putRes.json().catch(() => ({}))
        throw new Error((data.error as string | undefined) ?? '内容の保存に失敗しました')
      }
      const statusRes = await fetch(`/api/events/${ev.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      })
      if (!statusRes.ok) {
        const data = await statusRes.json().catch(() => ({}))
        throw new Error((data.error as string | undefined) ?? '承認に失敗しました')
      }
      setPendingEvents(prev => prev.filter(e => e.id !== ev.id))
      await loadEvents()
    } catch (e) {
      alert(e instanceof Error ? e.message : '承認に失敗しました')
    } finally {
      setPendingActionId(null)
    }
  }

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm(f => ({ ...f, [key]: val }))

  const handleEdit = (ev: CollectedEvent) => {
    setEditingId(ev.id)
    const base = eventToFormState(ev)
    setForm({
      ...base,
      posterType: fixedPosterType ?? base.posterType,
    })
    setFormInstanceKey(k => k + 1)
    setSubmitStatus('idle')
    setSubmitMessage('')
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setForm({ ...INITIAL_FORM, posterType: getInitialPosterType() })
    setSubmitStatus('idle')
    setSubmitMessage('')
    setFormInstanceKey(k => k + 1)
  }

  /** 既存イベントを複製し、新規登録フォームにプリフィルする（id/created_at は投稿時に新規発行される） */
  const handleDuplicate = async (ev: CollectedEvent) => {
    setShowDuplicateModal(false)
    setEditingId(null)
    const base = eventToFormState(ev)
    setForm({
      ...base,
      postedBy:   '',
      email:      '',
      posterType: getInitialPosterType(),
    })
    setSubmitStatus('idle')
    setSubmitMessage('')
    setFormInstanceKey(k => k + 1)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)

    // 複製元の全画像（event_images）を取得。event_images が空（旧データ等）の場合は events.image_url 1枚にフォールバック
    let sourceImages: { imageUrl: string; caption: string }[] = []
    try {
      const res  = await fetch(`/api/events/${ev.id}/images`)
      const data = await res.json()
      const rows: { imageUrl: string; caption?: string | null }[] = Array.isArray(data.images) ? data.images : []
      sourceImages = rows.map(r => ({ imageUrl: r.imageUrl, caption: r.caption ?? '' }))
    } catch {
      sourceImages = []
    }
    if (sourceImages.length === 0 && ev.imageUrl) {
      sourceImages = [{ imageUrl: ev.imageUrl, caption: '' }]
    }
    if (sourceImages.length === 0) return

    setDuplicatingImage(true)
    try {
      // 各画像の複製は自身で失敗を吸収し、他の画像の複製結果に影響しないようにする
      const results = await Promise.all(sourceImages.map(async img => {
        try {
          const res  = await fetch('/api/duplicate-image', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ url: img.imageUrl }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error((data.error as string | undefined) ?? '画像の複製に失敗しました')
          return { ok: true as const, url: data.url as string, caption: img.caption }
        } catch {
          return { ok: false as const }
        }
      }))

      const succeeded  = results.filter((r): r is { ok: true; url: string; caption: string } => r.ok)
      const failedCount = results.length - succeeded.length

      setForm(f => ({
        ...f,
        imageUrl:      succeeded[0]?.url ?? '',
        imageUrls:     succeeded.map(r => r.url),
        imageCaptions: succeeded.map(r => r.caption),
      }))

      if (failedCount > 0) {
        alert(`画像${failedCount}枚の複製に失敗しました。失敗した画像は手動でアップロードしてください（他の画像は複製済みです）`)
      }
    } finally {
      setDuplicatingImage(false)
    }
  }

  const handleDelete = async (ev: CollectedEvent) => {
    if (!window.confirm(`「${ev.name}」を削除しますか？`)) return
    try {
      const headers: Record<string, string> = {}
      if (restrictEditToOwn) {
        const token = getEditToken(ev.id)
        if (token) headers['x-edit-token'] = token
      }
      const res = await fetch(`/api/events/${ev.id}`, { method: 'DELETE', headers })
      if (!res.ok) {
        let data: Record<string, unknown> = {}
        try { data = await res.json() } catch { /* empty body */ }
        const message = (data.error as string | undefined) ?? '削除に失敗しました'
        throw new Error(res.status === 403
          ? `${message}。セッションが切れている可能性があります。ログアウトして再ログインしてください`
          : message)
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
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (editingId && restrictEditToOwn) {
        const token = getEditToken(editingId)
        if (token) headers['x-edit-token'] = token
      }
      const isPermanent = form.type === 'permanent'
      const isEventPlus = form.category === 'event_plus'
      const nearestDate = isEventPlus ? pickNearestEventDate(form.eventDates) : null
      const res = await fetch(url, {
        method,
        headers,
        body:    JSON.stringify({
        ...form,
        posterType:   fixedPosterType ?? form.posterType,
        scheduleNote: isPermanent ? '' : (form.dateConfirmed ? '' : form.scheduleNote),
        startDate:    isPermanent ? '' : isEventPlus ? (nearestDate?.startDate ?? '') : (form.dateConfirmed ? form.startDate : ''),
        endDate:      isPermanent ? '' : isEventPlus ? (nearestDate?.endDate   ?? '') : (form.dateConfirmed ? form.endDate   : ''),
        instagram_url: form.instagramUrl.trim() || null,
        x_url:         form.xUrl.trim() || null,
      }),
      })
      let data: Record<string, unknown> = {}
      try {
        data = await res.json()
      } catch {
        throw new Error(editingId ? '更新に失敗しました（サーバーエラー）' : '登録に失敗しました（サーバーエラー）')
      }
      if (!res.ok) {
        const message = (data.error as string | undefined) ?? (editingId ? '更新に失敗しました' : '登録に失敗しました')
        throw new Error(res.status === 403
          ? `${message}。セッションが切れている可能性があります。ログアウトして再ログインしてください`
          : message)
      }

      if (!editingId && restrictEditToOwn) {
        const newId    = (data.event as { id?: string } | undefined)?.id
        const newToken = data.editToken as string | undefined
        if (newId && newToken) setMyEvents(appendMyEvent(newId, newToken))
      }

      let eventDatesWarning = ''
      if (isEventPlus) {
        const savedEventId = editingId ?? (data.event as { id?: string } | undefined)?.id
        if (savedEventId) {
          try {
            const edRes = await fetch('/api/event-dates', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event_id: savedEventId,
                dates: form.eventDates.map(d => ({
                  startDate: d.startDate,
                  endDate:   d.endDate,
                  startTime: d.startTime,
                  endTime:   d.endTime,
                  venue:     d.useCustomVenue ? d.venue   : '',
                  address:   d.useCustomVenue ? d.address : '',
                  lat:       d.useCustomVenue ? d.lat : null,
                  lng:       d.useCustomVenue ? d.lng : null,
                  note:      d.note,
                })),
              }),
            })
            if (!edRes.ok) eventDatesWarning = '（日程の保存に失敗しました。もう一度保存してください）'
          } catch {
            eventDatesWarning = '（日程の保存に失敗しました。もう一度保存してください）'
          }
        }
      }

      setSubmitStatus('ok')
      const eventName = (data.event as { name?: string } | undefined)?.name ?? form.name
      setSubmitMessage((editingId
        ? `「${eventName}」を更新しました！`
        : showApprovalNotice
          ? `「${eventName}」の投稿を受け付けました。運営が確認後、地図に掲載されます。`
          : `「${eventName}」を登録しました！`) + eventDatesWarning)
      setForm({ ...INITIAL_FORM, posterType: getInitialPosterType() })
      setEditingId(null)
      setFormInstanceKey(k => k + 1)
      await loadEvents()
    } catch (e) {
      setSubmitStatus('error')
      setSubmitMessage(e instanceof Error ? e.message : (editingId ? '更新に失敗しました' : '登録に失敗しました'))
    }
  }

  const isSubmitting = submitStatus === 'loading'

  const allItems = events

  const filteredItems = debouncedQuery.trim()
    ? allItems.filter(ev => ev.name.toLowerCase().includes(debouncedQuery.trim().toLowerCase()))
    : allItems

  const isEndedEvent = (ev: CollectedEvent) =>
    getEventStatus(ev.startDate ?? ev.date, ev.endDate ?? ev.date) === 'ended'

  const sortByEndedLast = (items: CollectedEvent[]) =>
    [...items].sort((a, b) => Number(isEndedEvent(a)) - Number(isEndedEvent(b)))

  const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS) as Category[]
  const groupedItems = [
    ...CATEGORY_ORDER.map(cat => ({
      key: cat as string,
      label: CATEGORY_LABELS[cat],
      icon: cat,
      items: sortByEndedLast(filteredItems.filter(ev => (ev.category ?? 'event') === cat)),
    })),
    {
      key: 'other',
      label: 'その他',
      icon: filteredItems.find(ev => !CATEGORY_ORDER.includes((ev.category ?? 'event') as Category))?.category ?? 'event',
      items: sortByEndedLast(filteredItems.filter(ev => !CATEGORY_ORDER.includes((ev.category ?? 'event') as Category))),
    },
  ].filter(group => group.items.length > 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <a href="/" className="text-gray-400 hover:text-gray-600 text-sm">← 地図に戻る</a>
        <span className="text-gray-300">|</span>
        <h1 className="text-base font-bold text-gray-800">スポット管理</h1>
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
            {editingId ? 'スポットを編集' : '新規登録'}
          </h2>
          {showApprovalSection && !editingId && (
            <div className="mb-3">
              <button
                type="button"
                onClick={() => setShowDuplicateModal(true)}
                disabled={duplicatingImage}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600
                  hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                📋 既存イベントから複製
              </button>
              {duplicatingImage && (
                <span className="ml-2 text-xs text-gray-400">画像を複製中...</span>
              )}
            </div>
          )}
          {showApprovalNotice && !editingId && (
            <p className="mb-3 text-xs text-gray-900 leading-relaxed">
              ※ 投稿いただいた内容は、運営の確認後に地図に掲載されます
            </p>
          )}
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

            <EventFormFields
              key={formInstanceKey}
              form={form}
              onChange={set}
              disabled={isSubmitting}
              editing={!!editingId}
              eventId={editingId ?? undefined}
              posterTypeOptions={posterTypeOptions}
              fixedPosterType={fixedPosterType}
              onUploadingChange={setImageUploading}
              showEmail={showEmail}
              isStaffAdmin={showApprovalSection}
            />

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
              disabled={isSubmitting || imageUploading || duplicatingImage || !form.name ||
                (form.type === 'permanent' ? false :
                  form.category === 'event_plus'
                    ? (!form.venue || form.eventDates.length === 0)
                    : (!form.venue || (form.dateConfirmed ? (!form.startDate || !form.endDate) : !form.scheduleNote)))}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-colors cursor-pointer
                bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isSubmitting
                ? (editingId ? '更新中...' : '登録中...')
                : (editingId ? '上書き保存' : '投稿する')}
            </button>
          </form>
        </section>

        {/* 承認待ちイベント */}
        {showApprovalSection && (
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              承認待ちスポット{pendingEvents.length > 0 ? `（${pendingEvents.length}件）` : ''}
            </h2>
            {pendingLoading ? (
              <p className="text-sm text-gray-400">読み込み中...</p>
            ) : pendingEvents.length === 0 ? (
              <p className="text-sm text-gray-400">承認待ちのスポットはありません。</p>
            ) : (
              <ul className="space-y-2">
                {pendingEvents.map(ev => (
                  <PendingEventCard
                    key={ev.id}
                    event={ev}
                    expanded={expandedPendingId === ev.id}
                    onToggle={() => setExpandedPendingId(expandedPendingId === ev.id ? null : ev.id)}
                    busy={pendingActionId === ev.id}
                    onApprove={formValues => handleApprovePending(ev, formValues)}
                    onReject={() => handleRejectPending(ev)}
                    isStaffAdmin={showApprovalSection}
                  />
                ))}
              </ul>
            )}
          </section>
        )}

        {/* 登録済みスポット一覧 */}
        {!hideEventList && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">登録済みスポット</h2>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="スポット名で検索"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-blue-300 mb-2"
          />
          {eventsLoading ? (
            <p className="text-sm text-gray-400">読み込み中...</p>
          ) : allItems.length === 0 ? (
            <p className="text-sm text-gray-400">登録されたスポットはありません。</p>
          ) : (
            <div ref={listContainerRef} style={{ minHeight: listMinHeight }}>
              {groupedItems.map((group, groupIndex) => (
                <div key={group.key}>
                  <div className={`flex items-center gap-2 mb-2 ${groupIndex === 0 ? 'mt-0' : 'mt-2'}`}>
                    <span className="text-xs font-semibold text-gray-500">
                      ・{group.label}（{group.items.length}件）
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {group.items.map(ev => (
                      <li
                        key={ev.id}
                        className={`rounded-xl border px-4 py-3 flex items-start gap-3 transition-colors
                          ${editingId === ev.id
                            ? 'border-blue-300 bg-blue-50'
                            : isEndedEvent(ev)
                              ? 'border-gray-300 bg-gray-200'
                              : 'border-gray-100 bg-white'}`}
                      >
                        <span className="mt-0.5 flex-shrink-0">
                          <CategoryIcon category={ev.category ?? 'event'} size={20} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{ev.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{formatDateRange(ev)} · {ev.venue}</p>
                        </div>
                        {(!restrictEditToOwn || isMyEvent(ev.id)) && (
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
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
        )}

      </main>

      {showDuplicateModal && (
        <DuplicateEventModal
          events={events}
          onSelect={handleDuplicate}
          onClose={() => setShowDuplicateModal(false)}
        />
      )}

    </div>
  )
}
