import { Suspense } from 'react'
import MapApp from '@/app/components/MapApp'

// 視覚的には非表示（スクリーンリーダー・クローラー向け）。MapAppの外側（Suspenseの外）に置くことで
// フォールバック中も含め常にSSR出力に含まれるようにする
const visuallyHiddenStyle: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

export default function Page() {
  return (
    <>
      <h1 style={visuallyHiddenStyle}>群馬県のイベント・おでかけ情報 | グンマップ</h1>
      <Suspense fallback={null}>
        <MapApp />
      </Suspense>
    </>
  )
}
