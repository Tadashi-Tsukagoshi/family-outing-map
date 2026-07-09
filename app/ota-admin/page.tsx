'use client'

import { useState, useEffect } from 'react'
import AdminContent from '@/app/components/AdminContent'

const AUTH_KEY = 'ota-admin-authed'


export default function OtaAdminPage() {
  const [authed,       setAuthed]       = useState(false)
  const [loginPw,      setLoginPw]      = useState('')
  const [loginError,   setLoginError]   = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(AUTH_KEY) !== 'true') return
    setAuthed(true)

    // 体感速度維持のため即座に画面を出しつつ、裏でサーバー側セッションの有効性を確認する。
    // セッションCookieが失効/削除されていた場合はログイン画面に戻す。
    fetch('/api/admin/auth')
      .then(res => res.json())
      .then((data: { authed?: boolean }) => {
        if (!data.authed) {
          localStorage.removeItem(AUTH_KEY)
          setAuthed(false)
        }
      })
      .catch(() => {})
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: loginPw }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'パスワードが正しくありません')
      }
      localStorage.setItem(AUTH_KEY, 'true')
      setAuthed(true)
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'パスワードが正しくありません')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY)
    setAuthed(false)
    fetch('/api/admin/auth', { method: 'DELETE' }).catch(() => {})
  }

  if (authed) {
    return (
      <AdminContent
        fixedPosterType="staff"
        showApprovalSection
        onLogout={handleLogout}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <form
        onSubmit={handleLogin}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-xs space-y-4"
      >
        <h1 className="text-base font-bold text-gray-800 text-center">管理画面ログイン</h1>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
          <input
            type="password"
            value={loginPw}
            onChange={e => setLoginPw(e.target.value)}
            required
            autoFocus
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
        {loginError && (
          <p className="text-xs text-red-500">{loginError}</p>
        )}
        <button
          type="submit"
          disabled={loginLoading || !loginPw}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          {loginLoading ? 'ログイン中...' : 'ログイン'}
        </button>
      </form>
    </div>
  )
}
