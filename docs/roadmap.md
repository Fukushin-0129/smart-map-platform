# Roadmap

## Phase 0: ドキュメント整備

- プロダクト思想、仕様、データモデル、UX、AI、CSV、権限を文書化する。
- 現状分析を残す。
- 実装 PR を小さく分ける計画を作る。

## Phase 1: 既存アプリの安全化

- localStorage スキーマバージョンを追加する。
- 既存データのバックアップ・エクスポートを追加する。
- `ui.js` から KML、CSV、写真 GPS、チラシ配布、地図管理を分離する。
- 既存挙動を維持したままテストを追加する。

## Phase 2: Place 共通モデル導入

- Project / Channel のデフォルトモデルを追加する。
- 既存 stores と flyerApartments を Place 互換レイヤーで扱う。
- Layer を Project 配下の概念に整理する。
- 移行プレビューを追加する。

## Phase 3: MVP 汎用化

- プロジェクト切替。
- Place 共通管理。
- CSV 汎用列マッピング。
- レイヤー表示切替。
- スマホ地図主役 UI。
- チラシ配布 MVP とサラダマップ MVP。

## Phase 4: チーム利用

- Supabase Auth。
- Supabase Database。
- Row Level Security。
- 写真ストレージ。
- メンバー招待。
- オーナー、編集者、閲覧者。
- 操作履歴。

## Phase 5: AI 支援

- 近い順の並び替え。
- 未訪問・未配布抽出。
- 重複検出。
- データ不足検出。
- コメント要約。
- ルート最適化。
- 複数人への自動振り分け。

## Phase 6: 販売化

- Flyer Route Pro。
- Salad Map。
- Dance Studio Map。
- Sales Route。
- Property Route。
- Inspection Map。
- Tourism Map。
- Community Map。

## 小さな PR に分けた開発計画

1. `docs` 追加。
2. localStorage バックアップとスキーマバージョン追加。
3. `ui.js` から storage / parser / map 表示の抽出。
4. KML インポートのサービス化。
5. CSV インポート・エクスポートのサービス化。
6. 写真 GPS 処理のサービス化。
7. チラシ配布処理のサービス化。
8. Place 型定義と変換アダプター追加。
9. デフォルト Project 導入。
10. プロジェクト切替 UI。
11. スマホ向け地図主役レイアウト。
12. CSV 列マッピング UI。
13. Supabase 移行準備。
14. 認証と権限。
15. AI ルート最適化。

## 既存サラダマップを活かす移行計画

- 既存 `stores` を失わず、デフォルト Project `My Salad Map` に変換する。
- `name`、`category`、`description`、`lat`、`lng`、`address`、`placeId`、`photos` を Place に移す。
- `description` は Place `note` と Knowledge コメントの両方に変換できるようにする。
- KML 由来店舗は既存 Layer を維持する。
- Places 由来店舗は `source = googlePlaces`、`externalPlaceId = placeId` にする。
- 移行完了後も旧キーを一定期間残し、復元できるようにする。
