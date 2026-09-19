import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '@/lib/admin-session'
import AnalyticsContent from './AnalyticsContent'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  const adminPassword = process.env.ADMIN_PASSWORD
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value

  if (!adminPassword || !verifyAdminSessionToken(sessionToken, adminPassword)) {
    redirect('/ota-admin')
  }

  return <AnalyticsContent />
}
