import { Suspense } from 'react'
import MapApp from '@/app/components/MapApp'

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MapApp />
    </Suspense>
  )
}
