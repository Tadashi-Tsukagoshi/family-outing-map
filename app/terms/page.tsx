import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '利用規約 | グンマップ｜GUNMAp',
  description: 'グンマップ（GUNMAp）の利用規約です。',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <a href="/" className="text-gray-400 hover:text-gray-600 text-sm">← 地図に戻る</a>
        <span className="text-gray-300">|</span>
        <h1 className="text-base font-bold text-gray-800">利用規約</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
          <h2 className="text-lg font-bold text-gray-900 mb-1">グンマップ（GUNMAp）利用規約</h2>
          <p className="text-xs text-gray-400 mb-6">最終更新日：2026年9月14日</p>

          <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">第1条（適用）</h3>
              <p>
                本利用規約（以下「本規約」）は、グンマップ（GUNMAp）（以下「本サービス」、URL：https://gunma-odekakemap.jp）の利用に関する条件を定めるものです。本サービスを利用することにより、本規約に同意したものとみなします。
              </p>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">第2条（サービスの内容）</h3>
              <p>
                本サービスは、群馬県およびその周辺地域のイベント情報を地図上で閲覧できるWebサービスです。個人が運営しており、現在は無料でご利用いただけます。サービスの内容や提供条件は、今後変更される場合があります。
              </p>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">第3条（免責事項）</h3>
              <ol className="list-decimal pl-5 space-y-1">
                <li>本サービスに掲載されるイベント情報（日時、場所、内容、料金等）の正確性、最新性、完全性を保証するものではありません。実際の開催状況は主催者の公式情報をご確認ください。</li>
                <li>本サービスの利用により生じたいかなる損害についても、運営者は一切の責任を負いません。</li>
                <li>本サービスは予告なく内容の変更、一時停止、または終了する場合があります。</li>
              </ol>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">第4条（禁止事項）</h3>
              <p className="mb-2">本サービスの利用にあたり、以下の行為を禁止します。</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>本サービスの運営を妨げる行為（不正アクセス、過度なスクレイピング等）</li>
                <li>本サービスのデザイン、レイアウト、説明文等を無断で複製・模倣する行為</li>
                <li>法令または公序良俗に反する目的での利用</li>
                <li>その他、運営者が不適切と判断する行為</li>
              </ul>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">第5条（著作権・知的財産権）</h3>
              <p>
                本サービスのデザイン、レイアウト、運営者が作成した説明文等の著作権は、運営者に帰属します。掲載されているイベント画像等の著作権は、各イベント主催者またはその権利者に帰属します。
              </p>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">第6条（リンク）</h3>
              <p>
                本サービスには外部サイトへのリンクが含まれる場合があります。リンク先の内容・安全性について、運営者は一切の責任を負いません。
              </p>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">第7条（規約の変更）</h3>
              <p>
                運営者は、必要に応じて本規約を変更できるものとします。変更後の規約は、本サービス上に掲載した時点から効力を生じます。
              </p>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">第8条（準拠法・管轄）</h3>
              <p>
                本規約は日本法に準拠し、本サービスに関する紛争については、前橋地方裁判所太田支部を第一審の専属的合意管轄裁判所とします。
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
