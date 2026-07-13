'use client'

import { useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { CATEGORY_LABELS, PIN_COLORS, DEFAULT_PIN_COLOR, type Category, type EventType } from '@/lib/spots'
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
  startDate: '', endDate: '', scheduleNote: '',
  venue: '', fee: '', imageUrl: '', address: '',
  lat: null, lng: null,
  description: '', url: '',
  postedBy: '', posterType: 'general',
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
}

export default function EventFormFields({
  form, onChange, disabled, editing, posterTypeOptions, fixedPosterType, onUploadingChange,
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
          placeholder="例：太田ものづくりフェア2026"
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
            { value: 'permanent' as const, label: '常設施設' },
          ]).map(opt => (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => {
                set('type', opt.value)
                if (opt.value === 'permanent' && form.category !== 'park') set('category', 'park')
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
        <div className="grid grid-cols-4 gap-2">
          {categories.map(cat => {
            const categoryDisabled = disabled || (isPermanent && cat !== 'park')
            return (
              <button
                key={cat}
                type="button"
                disabled={categoryDisabled}
                onClick={() => set('category', cat)}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-colors
                  ${categoryDisabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}
                  ${form.category === cat
                    ? 'border-green-400 bg-green-50 text-green-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
              >
                <CategoryIcon category={cat} active={form.category === cat} size={28} />
                {CATEGORY_LABELS[cat].replace('・', '・\n')}
              </button>
            )
          })}
        </div>
      </div>

      {/* ピンの色（常設施設のみ） */}
      {form.category === 'park' && (
        <div>
          <Label>ピンの色</Label>
          <div className="flex gap-2">
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
                    width: 32, height: 32, borderRadius: '50%',
                    backgroundColor: color,
                    border: isSelected ? '2.5px solid #1f2937' : '2.5px solid transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  className={disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}
                >
                  {isSelected && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 日程確定トグル */}
      <div className={isPermanent ? 'opacity-40' : undefined}>
        <Label required={!isPermanent}>日程</Label>
        <div className="flex gap-2 mb-3">
          {([true, false] as const).map(confirmed => (
            <button
              key={String(confirmed)}
              type="button"
              disabled={disabled || isPermanent}
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
              <Label required={!isPermanent}>開始日</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={e => set('startDate', e.target.value)}
                required={!isPermanent}
                disabled={disabled || isPermanent}
              />
            </div>
            <div>
              <Label required={!isPermanent}>終了日</Label>
              <Input
                type="date"
                value={form.endDate}
                min={form.startDate}
                onChange={e => set('endDate', e.target.value)}
                required={!isPermanent}
                disabled={disabled || isPermanent}
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
              <Label required={!isPermanent}>開催予定時期</Label>
              <Input
                value={form.scheduleNote}
                onChange={e => set('scheduleNote', e.target.value)}
                placeholder="例：7月下旬頃"
                required={!isPermanent}
                disabled={disabled || isPermanent}
              />
            </div>
          </>
        )}
      </div>

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
