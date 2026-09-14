import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'プライバシーポリシー | グンマップ｜GUNMAp',
  description: 'グンマップ（GUNMAp）のプライバシーポリシーです。',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <a href="/" className="text-gray-400 hover:text-gray-600 text-sm">← 地図に戻る</a>
        <span className="text-gray-300">|</span>
        <h1 className="text-base font-bold text-gray-800">プライバシーポリシー</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
          <h2 className="text-lg font-bold text-gray-900 mb-1">グンマップ（GUNMAp）プライバシーポリシー</h2>
          <p className="text-xs text-gray-400 mb-6">最終更新日：2026年9月14日</p>

          <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
            <p>
              グンマップ（GUNMAp）（以下「本サービス」、URL：https://gunma-odekakemap.jp）は、個人が運営するWebサービスです。本サービスにおける個人情報およびユーザー情報の取り扱いについて、以下のとおり定めます。
            </p>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">1. 取得する情報</h3>
              <div className="space-y-3">
                <p>
                  <span className="font-semibold text-gray-800">（1）位置情報</span><br />
                  本サービスでは、お使いのブラウザの位置情報機能（Geolocation API）を利用して現在地を取得することがあります。この情報はお使いの端末上でのみ処理され（距離フィルタ、現在地マーカーの表示）、サーバーへの送信や保存は一切行いません。位置情報の提供はブラウザの許可設定により任意です。
                </p>
                <p>
                  <span className="font-semibold text-gray-800">（2）アクセスログ</span><br />
                  本サービスのホスティングサービス（Vercel）により、アクセス日時、IPアドレス、ブラウザ情報などのアクセスログが自動的に記録される場合があります。これらはサービスの運用・改善目的で利用されます。
                </p>
                <p>
                  <span className="font-semibold text-gray-800">（3）お問い合わせ・イベント掲載申込みの情報</span><br />
                  お問い合わせやイベント掲載の申し込み（Googleフォーム経由）の際にご入力いただいた情報（お名前、メールアドレス、お問い合わせ内容等）は、対応のために利用し、対応完了後は適切に管理します。
                </p>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">2. Cookieについて</h3>
              <p>
                本サービスでは、運営者が明示的にCookieを設定することはありません。ただし、利用している外部サービス（Vercel、Mapbox等）がCookieを使用する場合があります。
              </p>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">3. 外部サービスの利用</h3>
              <p className="mb-2">
                本サービスでは、以下の外部サービスを利用しています。各サービスにおける情報の取り扱いについては、それぞれのプライバシーポリシーをご参照ください。
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  Mapbox（地図の表示）：
                  <a href="https://www.mapbox.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all">
                    https://www.mapbox.com/legal/privacy
                  </a>
                </li>
                <li>
                  Vercel（ホスティング・アクセスログ）：
                  <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all">
                    https://vercel.com/legal/privacy-policy
                  </a>
                </li>
                <li>
                  Supabase（イベントデータの管理）：
                  <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all">
                    https://supabase.com/privacy
                  </a>
                </li>
                <li>
                  Google フォーム（お問い合わせ・イベント掲載申込み）：
                  <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all">
                    https://policies.google.com/privacy
                  </a>
                </li>
              </ul>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">4. 第三者への提供</h3>
              <p>取得した情報を、法令に基づく場合を除き、第三者に提供することはありません。</p>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">5. ポリシーの変更</h3>
              <p>本ポリシーは、必要に応じて改定する場合があります。改定後のポリシーは、本サービス上に掲載した時点から効力を生じます。</p>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">6. お問い合わせ</h3>
              <p>
                本サービスに関するお問い合わせは、以下までご連絡ください。<br />
                メール：info@gunma-odekakemap.jp
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
