import { supabaseAdmin } from '@/lib/supabase'
import { isAdminRequest } from '@/lib/admin-session'
import { pickNearestEventDate } from '@/lib/date-utils'
import type { NextRequest } from 'next/server'

/** event_plus の日程1件を削除する（管理画面の「通常イベントへ変更」で、新規登録成功後に元の日程を親から外すために使用） */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(req)) {
    return Response.json({ error: '権限がありません' }, { status: 403 })
  }

  const { id } = await ctx.params
  const supabase = supabaseAdmin()

  const { data: dateRow, error: findError } = await supabase
    .from('event_dates')
    .select('id, event_id')
    .eq('id', id)
    .maybeSingle()

  // 22P02 = id の型不一致（親側で未保存の日程はクライアント生成のidのため）。未登録として扱う
  if (findError && findError.code !== '22P02') {
    console.error('[DELETE /api/event-dates/[id]] find failed', findError)
    return Response.json({ error: '日程の取得に失敗しました' }, { status: 500 })
  }
  if (!dateRow) {
    return Response.json({ error: '日程が見つかりません' }, { status: 404 })
  }

  const eventId = dateRow.event_id

  const { error: imgError } = await supabase.from('event_images').delete().eq('event_date_id', id)
  if (imgError) {
    console.error('[DELETE /api/event-dates/[id]] event_images delete failed', imgError)
    return Response.json({ error: '日程の画像の削除に失敗しました' }, { status: 500 })
  }

  const { error: delError } = await supabase.from('event_dates').delete().eq('id', id)
  if (delError) {
    console.error('[DELETE /api/event-dates/[id]] delete failed', delError)
    return Response.json({ error: '日程の削除に失敗しました' }, { status: 500 })
  }

  // 残りの日程から親イベントの start_date/end_date（ピンのステータス判定用）を更新。残り0件なら変更しない
  const { data: remaining, error: remainError } = await supabase
    .from('event_dates')
    .select('start_date, end_date')
    .eq('event_id', eventId)
  if (remainError) {
    console.error('[DELETE /api/event-dates/[id]] remaining fetch failed', remainError)
    return Response.json({ error: '親イベントの日付更新に失敗しました' }, { status: 500 })
  }

  if (remaining && remaining.length > 0) {
    const nearest = pickNearestEventDate(remaining.map(r => ({ startDate: r.start_date ?? '', endDate: r.end_date ?? '' })))
    if (nearest) {
      const { error: updError } = await supabase
        .from('events')
        .update({ start_date: nearest.startDate, end_date: nearest.endDate })
        .eq('id', eventId)
      if (updError) {
        console.error('[DELETE /api/event-dates/[id]] parent update failed', updError)
        return Response.json({ error: '親イベントの日付更新に失敗しました' }, { status: 500 })
      }
    }
  }

  return Response.json({ success: true })
}
