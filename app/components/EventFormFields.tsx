'use client'

import { useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { CATEGORY_LABELS, CATEGORY_BUTTON_LABEL_OVERRIDES, PIN_COLORS, DEFAULT_PIN_COLOR, type Category, type EventType } from '@/lib/spots'
import { CategoryIcon } from './Sidebar'
import type { CollectedEvent } from '@/lib/events'
import { resizeImage } from '@/lib/image-utils'

const MapPicker = dynamic(() => import('./MapPicker'), { ssr: false })

export type PosterType = 'general' | 'organizer' | 'business' | 'staff'

export type FormState = {
  name:          string
  category:      Category
  type:          EventType
  pinColor:      string
  dateConfirmed: boolean
  startDate:     string
  endDate:       string
  startTime:     string
  endTime:       string
  businessHours: string
  spotLabel:     string
  scheduleNote:  string
  venue:         string
  fee:           string
  imageUrl:      string
  address:       string
  lat:           number | null
  lng:           number | null
  description:   string
  url:           string
  postedBy:      string
  email:         string
  posterType:    PosterType
}

type GeoStatus   = 'idle' | 'loading' | 'ok' | 'error'
type ImageStatus = 'idle' | 'uploading' | 'ok' | 'error'

export const POSTER_TYPE_LABELS: Record<string, string> = {
  general:   '一般ユーザー',
  organizer: '主催者',
  business:  '事業者',
  staff:     '運営',
}

export const INITIAL_FORM: FormState = {
  name: '', category: 'event',
  type: 'event',
  pinColor: DEFAULT_PIN_COLOR,
  dateConfirmed: true,
  startDate: '', endDate: '', startTime: '', endTime: '', businessHours: '', spotLabel: '', scheduleNote: '',
  venue: '', fee: '', imageUrl: '', address: '',
  lat: null, lng: null,
  description: '', url: '',
  postedBy: '', email: '', posterType: 'general',
}

/** 既存イベントをフォームの初期値に変換する（編集・承認待ちの編集の両方で使用） */
export function eventToFormState(ev: CollectedEvent): FormState {
  const hasScheduleNote = !!ev.scheduleNote
  return {
    name:          ev.name,
    category:      ev.category ?? 'event',
    type:          ev.type ?? 'event',
    pinColor:      ev.pinColor ?? DEFAULT_PIN_COLOR,
    dateConfirmed: !hasScheduleNote,
    startDate:     ev.startDate ?? ev.date ?? '',
    endDate:       ev.endDate   ?? ev.date ?? '',
    startTime:     ev.startTime ?? '',
    endTime:       ev.endTime ?? '',
    businessHours: ev.businessHours ?? '',
    spotLabel:     ev.spotLabel ?? '',
    scheduleNote:  ev.scheduleNote ?? '',
    venue:         ev.venue,
    fee:           ev.fee ?? '',
    imageUrl:      ev.imageUrl ?? '',
    address:       '',
    lat:           ev.lat,
    lng:           ev.lng,
    description:   ev.description,
    url:           ev.url ?? '',
    postedBy:      ev.postedBy ?? '',
    email:         ev.email ?? '',
    posterType:    (ev.posterType as PosterType) ?? 'general',
  }
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

const TIME_HOURS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const TIME_MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

/** "HH:MM" 文字列を時・分の select 2つで編集する。両方選択されて初めて親に反映する */
function TimeSelect({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [hour, setHour]     = useState(() => value.split(':')[0] ?? '')
  const [minute, setMinute] = useState(() => value.split(':')[1] ?? '')

  const commit = (h: string, m: string) => onChange(h && m ? `${h}:${m}` : '')

  const selectClassName = `rounded-lg border border-gray-300 px-2 py-2 text-sm bg-white
    focus:outline-none focus:ring-2 focus:ring-green-400 disabled:bg-gray-50 disabled:text-gray-500`

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={hour}
        onChange={e => { setHour(e.target.value); commit(e.target.value, minute) }}
        disabled={disabled}
        className={selectClassName}
      >
        <option value="">--</option>
        {TIME_HOURS.map(h => <option key={h} value={h}>{Number(h)}</option>)}
      </select>
      <span className="text-gray-400">:</span>
      <select
        value={minute}
        onChange={e => { setMinute(e.target.value); commit(hour, e.target.value) }}
        disabled={disabled}
        className={selectClassName}
      >
        <option value="">--</option>
        {TIME_MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
    </div>
  )
}

type Props = {
  form:     FormState
  onChange: <K extends keyof FormState>(key: K, val: FormState[K]) => void
  disabled?: boolean
  /** true の場合、既存イベントの編集として扱う（住所を必須にしない・位置情報の案内文を変える） */
  editing?: boolean
  posterTypeOptions?: { value: PosterType; label: string }[]
  fixedPosterType?: PosterType
  /** 画像アップロード中かどうかを親に通知する（送信ボタンの無効化判定などに使用） */
  onUploadingChange?: (uploading: boolean) => void
  /** true の場合、メールアドレス（任意）入力欄を表示する（一般公開の /admin 用） */
  showEmail?: boolean
}

export default function EventFormFields({
  form, onChange, disabled, editing, posterTypeOptions, fixedPosterType, onUploadingChange, showEmail,
}: Props) {
  const hasInitialLocation = form.lat !== null && form.lng !== null
  const [geoStatus,  setGeoStatus]  = useState<GeoStatus>(() => (editing && hasInitialLocation) ? 'ok' : 'idle')
  const [geoMessage, setGeoMessage] = useState(() =>
    (editing && hasInitialLocation) ? '📍 既存の位置情報を使用中（住所を入力して「取得」を押すと更新できます）' : '')
  const [showMapPicker, setShowMapPicker] = useState(false)
  const [imageStatus,  setImageStatus]  = useState<ImageStatus>('idle')
  const [imageMessage, setImageMessage] = useState('')
  const geoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const set = onChange
  const isPermanent = form.type === 'permanent'

  const geocode = async (address: string) => {
    if (!address.trim()) return
    setGeoStatus('loading')
    setGeoMessage('住所を検索中...')
    try {
      const res  = await fetch(`/api/geocode?q=${encodeURIComponent(address + ' 日本')}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '取得失敗')
      set('lat', data.lat)
      set('lng', data.lng)
      setGeoStatus('ok')
      setGeoMessage(`📍 ${data.display_name}`)
    } catch (e) {
      setGeoStatus('error')
      setGeoMessage(e instanceof Error ? e.message : '住所が見つかりませんでした')
      set('lat', null)
      set('lng', null)
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

  const handleImageChange = async (file: File | null) => {
    if (!file) return
    setImageStatus('uploading')
    setImageMessage('画像をアップロード中...')
    onUploadingChange?.(true)
    try {
      const blob = await resizeImage(file)
      const fd   = new FormData()
      fd.append('file', blob, 'image.jpg')
      const res  = await fetch('/api/upload-image', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error((data.error as string | undefined) ?? 'アップロードに失敗しました')
      set('imageUrl', data.url as string)
      setImageStatus('ok')
      setImageMessage('アップロードしました')
    } catch (e) {
      setImageStatus('error')
      setImageMessage(e instanceof Error ? e.message : 'アップロードに失敗しました')
    } finally {
      onUploadingChange?.(false)
    }
  }

  const handleImageRemove = () => {
    set('imageUrl', '')
    setImageStatus('idle')
    setImageMessage('')
  }

  const categories = Object.keys(CATEGORY_LABELS) as Category[]

  return (
    <>
      {/* イベント・施設名 */}
      <div>
        <Label required>イベント・施設名</Label>
        <Input
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder={isPermanent ? '例：金山総合公園、道の駅おおた' : '例：太田ものづくりフェア2026'}
          required
          disabled={disabled}
        />
      </div>

      {/* 種別 */}
      <div>
        <Label required>種別</Label>
        <div className="flex gap-2">
          {([
            { value: 'event' as const,     label: '期間限定イベント' },
            { value: 'permanent' as const, label: '常設スポット' },
          ]).map(opt => (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => {
                set('type', opt.value)
                if (opt.value === 'permanent') {
                  if (form.category !== 'park') set('category', 'park')
                  set('startTime', '')
                  set('endTime', '')
                } else {
                  if (form.category === 'park') set('category', 'event')
                  set('businessHours', '')
                  set('spotLabel', '')
                }
              }}
              className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-colors cursor-pointer
                ${form.type === opt.value
                  ? 'border-green-400 bg-green-50 text-green-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* カテゴリ */}
      <div>
        <Label required>カテゴリ</Label>
        <div className="grid grid-cols-4 gap-2 items-start">
          {categories.map(cat => {
            const categoryMismatch = isPermanent ? cat !== 'park' : cat === 'park'
            const categoryDisabled = disabled || categoryMismatch
            const categoryButton = (
              <button
                key={cat}
                type="button"
                disabled={categoryDisabled}
                onClick={() => set('category', cat)}
                style={categoryMismatch ? { opacity: 0.3, pointerEvents: 'none' } : undefined}
                className={`w-full flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-colors
                  ${categoryDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}
                  ${disabled && !categoryMismatch ? 'opacity-40' : ''}
                  ${form.category === cat
                    ? 'border-green-400 bg-green-50 text-green-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
              >
                <CategoryIcon category={cat} active={form.category === cat} size={28} />
                {CATEGORY_BUTTON_LABEL_OVERRIDES[cat] ?? CATEGORY_LABELS[cat]}
              </button>
            )

            if (cat !== 'park' && cat !== 'event') return categoryButton

            return (
              <div key={cat} className="flex flex-col gap-1.5">
                {categoryButton}
                {form.category === cat && (
                  <div className="flex flex-wrap md:flex-nowrap justify-center md:justify-around gap-x-1 gap-y-1.5 md:gap-x-0">
                    {PIN_COLORS.map(color => {
                      const isSelected = form.pinColor === color
                      return (
                        <button
                          key={color}
                          type="button"
                          disabled={disabled}
                          onClick={() => set('pinColor', color)}
                          aria-label={color}
                          style={{
                            backgroundColor: color,
                            border: isSelected ? '2px solid #1f2937' : '2px solid transparent',
                          }}
                          className={`w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center flex-shrink-0
                            ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
                        >
                          {isSelected && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                              <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 日程（期間限定イベント）/ 営業時間・紹介文（常設施設） */}
      {isPermanent ? (
        <>
          <div>
            <Label>営業時間</Label>
            <Input
              value={form.businessHours}
              onChange={e => set('businessHours', e.target.value)}
              placeholder="例：9:00〜17:00 / 月曜定休"
              disabled={disabled}
            />
          </div>
          <div>
            <Label>スポットの紹介文</Label>
            <Input
              value={form.spotLabel}
              onChange={e => set('spotLabel', e.target.value)}
              placeholder="例：定番スポット、新規スポット"
              disabled={disabled}
            />
          </div>
        </>
      ) : (
        <div>
          <Label required>日程</Label>
          <div className="flex gap-2 mb-3">
            {([true, false] as const).map(confirmed => (
              <button
                key={String(confirmed)}
                type="button"
                disabled={disabled}
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
            <>
              <div className="flex gap-3">
                <div style={{ width: 'calc(50% - 6px)' }}>
                  <Label required>開始日</Label>
                  <Input
                    type="date"
                    value={form.startDate}
                    onChange={e => set('startDate', e.target.value)}
                    required
                    disabled={disabled}
                    style={{ WebkitAppearance: 'none', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ width: 'calc(50% - 6px)' }}>
                  <Label required>終了日</Label>
                  <Input
                    type="date"
                    value={form.endDate}
                    min={form.startDate}
                    onChange={e => set('endDate', e.target.value)}
                    required
                    disabled={disabled}
                    style={{ WebkitAppearance: 'none', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <Label>開始時刻</Label>
                  <TimeSelect
                    value={form.startTime}
                    onChange={v => set('startTime', v)}
                    disabled={disabled}
                  />
                </div>
                <div>
                  <Label>終了時刻</Label>
                  <TimeSelect
                    value={form.endTime}
                    onChange={v => set('endTime', v)}
                    disabled={disabled}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex gap-3 mb-3">
                <div style={{ width: 'calc(50% - 6px)' }}>
                  <Label>開始日</Label>
                  <Input
                    type="date"
                    value=""
                    disabled
                    className="opacity-40"
                    style={{ WebkitAppearance: 'none', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ width: 'calc(50% - 6px)' }}>
                  <Label>終了日</Label>
                  <Input
                    type="date"
                    value=""
                    disabled
                    className="opacity-40"
                    style={{ WebkitAppearance: 'none', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div>
                <Label required>開催予定時期</Label>
                <Input
                  value={form.scheduleNote}
                  onChange={e => set('scheduleNote', e.target.value)}
                  placeholder="例：7月下旬頃"
                  required
                  disabled={disabled}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* 会場名 */}
      <div className={isPermanent ? 'opacity-40' : undefined}>
        <Label required={!isPermanent}>会場名</Label>
        <Input
          value={form.venue}
          onChange={e => set('venue', e.target.value)}
          placeholder="例：太田市総合体育館"
          required={!isPermanent}
          disabled={disabled || isPermanent}
        />
      </div>

      {/* 料金 */}
      <div>
        <Label>料金</Label>
        <Input
          value={form.fee}
          onChange={e => set('fee', e.target.value)}
          placeholder="例：大人500円・子ども無料"
          disabled={disabled}
        />
      </div>

      {/* 住所 + ジオコーディング */}
      <div>
        <Label required={!editing}>住所</Label>
        <p className="text-xs text-gray-400 mb-1">
          {editing
            ? '住所を入力して「取得」を押すと位置情報を更新できます。'
            : '都道府県から入力すると精度が上がります。入力後に自動取得、または「取得」ボタンを押してください。'}
        </p>
        <div className="flex gap-2">
          <Input
            value={form.address}
            onChange={e => onAddressChange(e.target.value)}
            placeholder="例：群馬県太田市飯塚町1059-1"
            disabled={disabled}
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => geocode(form.address)}
            disabled={!form.address.trim() || geoStatus === 'loading' || disabled}
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
          disabled={disabled}
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
                set('lat', lat)
                set('lng', lng)
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
          disabled={disabled}
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
          disabled={disabled}
        />
      </div>

      {/* 画像 */}
      <div>
        <Label>画像</Label>
        <p className="text-xs text-gray-400 mb-1">
          任意。1枚までアップロードできます（自動でリサイズ・圧縮されます）。
        </p>
        {form.imageUrl ? (
          <div className="flex items-center gap-3">
            <img
              src={form.imageUrl}
              alt=""
              className="w-24 h-16 object-cover rounded-lg border border-gray-200"
            />
            <button
              type="button"
              onClick={handleImageRemove}
              disabled={disabled || imageStatus === 'uploading'}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg border border-gray-300 text-xs text-gray-600
                hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              画像を削除
            </button>
          </div>
        ) : (
          <input
            type="file"
            accept="image/*"
            onChange={e => handleImageChange(e.target.files?.[0] ?? null)}
            disabled={disabled || imageStatus === 'uploading'}
            className="block w-full text-sm text-gray-600
              file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-gray-300
              file:text-sm file:bg-white file:text-gray-600 hover:file:bg-gray-50
              file:cursor-pointer disabled:opacity-50"
          />
        )}
        {imageMessage && (
          <p className={`mt-1.5 text-xs leading-snug
            ${imageStatus === 'ok'        ? 'text-green-600' : ''}
            ${imageStatus === 'error'     ? 'text-red-500'   : ''}
            ${imageStatus === 'uploading' ? 'text-gray-400'  : ''}`}>
            {imageMessage}
          </p>
        )}
      </div>

      {/* ニックネーム */}
      <div>
        <Label required>ニックネーム・ハンドルネーム</Label>
        <Input
          value={form.postedBy}
          onChange={e => set('postedBy', e.target.value)}
          placeholder="例：太田っ子、匿名　など"
          required
          disabled={disabled}
        />
      </div>

      {/* メールアドレス */}
      {showEmail && (
        <div>
          <Label>メールアドレス（任意）</Label>
          <Input
            type="email"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            placeholder="例：example@mail.com"
            disabled={disabled}
          />
          <p className="mt-1 text-xs text-gray-400">
            ご入力いただいた場合、投稿内容の確認メールをお送りします
          </p>
        </div>
      )}

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
                disabled={disabled}
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
    </>
  )
}
