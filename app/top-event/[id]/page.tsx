import type { Metadata } from 'next'
import { buildEventMetadata, getApprovedEventSpot } from '@/lib/seo'
import TopPage from '../../page'

// トップページに ?event={イベントID} が付いたとき、proxy.ts からこのページに振り分ける（URL は /?event=... のまま）。
// 画面はトップページと同じで、OGP・メタタグだけそのイベントのものにする。
// イベント登録内容は更新されうるため、/events/[id] と同じ間隔で再生成する
export const revalidate = 1800

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const spot = await getApprovedEventSpot(id)
  // 未承認・却下・存在しない ID のときは、トップページの既存 OGP（layout の既定）のまま
  if (!spot) return {}
  return buildEventMetadata(spot)
}

export default function TopEventPage() {
  return <TopPage />
}
