# 群馬県おでかけまっぷ 開発プロジェクト

## 概要
群馬県とその周辺地域のイベント情報を地図上で探せるWebアプリをClaude Codeで開発している。地理的範囲は県境ではなく距離ベース（例：埼玉県熊谷市も対象）。ユーザーはコードを読まないため、開発指示はすべてコピペ可能なClaude Codeプロンプト形式で提示すること。

## 技術構成
- フレームワーク：Next.js（App Router）+ TypeScript + Tailwind CSS
- 地図：OpenStreetMap + Leaflet（Mapboxアカウントあり、将来のスタイリング用）
- データ永続化：Supabase（PostgreSQL + RLS + Storage）
- デプロイ：Vercel（GitHub連携で自動デプロイ）+ Vercel Analytics導入済み
- 本番URL：https://family-outing-map.vercel.app/
- GitHubリポジトリ：Tadashi-Tsukagoshi/family-outing-map
- ローカルパス：~/Desktop/family-outing-map
- アイコン：Noto Emoji PNG（sparkler, lantern）、カスタムcanopy SVG（色はspot IDハッシュ mod 3）
- PWAファビコン：「群」ダーク丸アイコン

## Supabase
- プロジェクトURL：https://altybbfrtmpzwpzkoxdd.supabase.co
- eventsテーブルのカラム：id, name, description, start_date, end_date, venue, lat, lng, category, url, collected_at, posted_by, poster_type, created_at, schedule_note, likes, fee, image_url, address（addressは未使用）
- Storageバケット：event-images（公開、画像アップロード用）
- カテゴリ：event（イベント）/ fireworks（花火）/ festival（まつり）

## 実装済み機能
- 地図上にカテゴリ別ピン表示（イベント/花火/まつり）、Noto/カスタムSVGアイコン
- ホバー吹き出し・詳細パネル（モバイル：ボトムシート、PC：サイドバー）統一デザイン（青背景 #dbeafe）
- 全画面画像ライトボックス（React Portal）、OGP自動取得画像は元URLを新タブで開く
- イベント登録・編集・削除（/admin 一般用、/ota-admin 運営用、HMAC署名セッションCookie認証）
- 自己編集機能（localStorageトークン edit_token）
- イベント詳細パネル（日時/会場/料金/説明/投稿者ラベル/ステータスバッジ）
- いいね機能（ログイン不要、localStorage重複排除、トグル式）
- 画像アップロード（Supabase Storage、1枚、クライアント側リサイズ）
- イベントステータス：ended/upcoming(まもなく開催・7日以内)/scheduled(開催予定・8日以上先)/active(開催中)
- 期間フィルタ（プルダウン：すべて/2週間/1ヶ月/2ヶ月/3ヶ月/6ヶ月）
- 距離フィルタスライダー（10〜60km、10km刻み、fitBounds使用）
- カテゴリフィルタ（イベント/花火/まつり）
- サイドバーイベント一覧に日付情報表示
- 日程未定イベント対応（schedule_note）
- 住所→緯度経度のジオコーディング、地図ピン直接指定
- お問い合わせ（Googleフォーム連携、スマホポップアップ内リンク）
- スマホUX（左上「群馬県おでかけまっぷ」ピルボタン、ボトムシート、イベント一覧タップで地図中央表示）
- PWA対応
- Leafletズームコントロールのライトボックス時非表示（直接DOM操作）
- 終了イベントページ（/ended-events）、サイドバーからスクロール最下部にリンク
- Vercel Analytics

## 開発ルール
- 開発指示はコピペ可能なClaude Codeプロンプト形式で
- 結論・要点を先に
- 敬語を使う
- 勝手に方針を決めて検討を進めない、確認してから進める
- Supabaseのカラム追加SQLはユーザーが手動実行する
- コミットメッセージは日本語
- Vercelデプロイ確認は `npx vercel ls 2>&1 | head -8` を1回だけ（ポーリング禁止）
- 実装前に必ず比較・分析（フォントサイズ確認、デザインプレビュー等）してから

## 未実装・将来検討
- 画像2枚以上は課金（決済機能は未実装）
- 地図未確定イベントの年月のみ入力
- 終了イベントの表示方法統一、年次イベントの翌年復活機能
- マルチ日程イベント登録（例：毎週開催）
- テストデータ削除（テスト11, テスト16, test music）
- イベント自動収集ワークフロー（Claudeによるオンデマンド検索、URL必須）
