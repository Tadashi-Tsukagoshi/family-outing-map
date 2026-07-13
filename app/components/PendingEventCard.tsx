'use client'

import { useState } from 'react'
import EventFormFields, { type FormState, POSTER_TYPE_LABELS, eventToFormState } from './EventFormFields'
import { CategoryIcon } from './Sidebar'
import { formatDateRange, type CollectedEvent } from '@/lib/events'

type Props = {
  event: CollectedEvent
  expanded: boolean
  onToggle: () => void
  busy: boolean
  onApprove: (form: FormState) => void
  onReject: () => void
}

export default function PendingEventCard({ event, expanded, onToggle, busy, onApprove, onReject }: Props) {
  const [form, setForm] = useState<FormState>(() => eventToFormState(event))
  const [uploading, setUploading] = useState(false)

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm(f => ({ ...f, [key]: val }))

  return (
    <li className="bg-white rounded-xl border border-amber-200 overflow-hidden">
      <form onSubmit={e => { e.preventDefault(); onApprove(form) }}>
        <div
          onClick={onToggle}
          className="px-4 py-3 flex items-start gap-3 cursor-pointer"
        >
          <span className="mt-0.5 flex-shrink-0">
            <CategoryIcon category={event.category ?? 'event'} size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{event.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{formatDateRange(event)} · {event.venue}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              投稿者：{event.postedBy ?? '匿名'}（{POSTER_TYPE_LABELS[event.posterType ?? 'general'] ?? event.posterType}）
            </p>
            {event.email && (
              <p className="text-xs text-gray-400 mt-0.5">
                メール：
                <a
                  href={`mailto:${event.email}`}
                  onClick={e => e.stopPropagation()}
                  className="text-blue-500 hover:text-blue-700 underline"
                >
                  {event.email}
                </a>
              </p>
            )}
          </div>
          <div onClick={e => e.stopPropagation()} className="flex gap-1.5 flex-shrink-0">
            <button
              type="submit"
              disabled={busy || uploading}
              className="px-2.5 py-1 text-xs rounded-lg border border-green-200 text-green-600
                hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              承認
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={busy}
              className="px-2.5 py-1 text-xs rounded-lg border border-red-200 text-red-500
                hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              却下
            </button>
          </div>
          <span className="mt-1 flex-shrink-0 text-gray-300 text-[10px] select-none">
            {expanded ? '▲' : '▼'}
          </span>
        </div>

        {expanded && (
          <div
            onClick={e => e.stopPropagation()}
            className="px-4 pb-4 pt-2 border-t border-amber-100 space-y-5"
          >
            <EventFormFields
              form={form}
              onChange={set}
              disabled={busy}
              editing
              fixedPosterType={event.posterType ?? 'general'}
              onUploadingChange={setUploading}
            />
          </div>
        )}
      </form>
    </li>
  )
}
