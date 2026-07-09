'use client'

import AdminContent from '@/app/components/AdminContent'

export default function AdminPage() {
  return (
    <AdminContent
      restrictEditToOwn
      hideEventList
      posterTypeOptions={[
        { value: 'general',   label: '一般ユーザー' },
        { value: 'organizer', label: '主催者' },
        { value: 'business',  label: '事業者' },
      ]}
    />
  )
}
