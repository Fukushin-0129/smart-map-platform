# Architecture

## 現在の構成

現在は外部 npm パッケージなしの静的 SPA です。

- `index.html`: アプリのエントリ HTML。
- `src/main.js`: `initializeApp` を呼び出す起動ファイル。
- `src/modules/ui.js`: UI 描画、イベント、Google Maps、KML、CSV、写真 GPS、チラシ配布を含む主要ロジック。
- `src/modules/storage.js`: localStorage の読み書き。
- `src/modules/constants.js`: API キー、保存キー、色、ステータスなどの定数。
- `src/modules/utils.js`: HTML エスケープ、座標検証、距離計算、ファイル読み込み。
- `scripts/build.mjs`: Vercel 向け静的ビルド。
- `server.mjs`: ローカル開発サーバー。

## 目標アーキテクチャ

```text
UI Layer
├── Map View
├── Bottom Sheet / Side Panel
├── Project Switcher
├── Import / Export Screens
└── Admin Screens

Application Layer
├── Project Service
├── Place Service
├── Knowledge Service
├── History Service
├── Layer Service
├── Import Service
├── Export Service
├── Route Service
└── AI Service

Domain Layer
├── Project
├── Place
├── Knowledge
├── History
├── User
├── Permission
└── Layer

Infrastructure Layer
├── LocalStorage Adapter
├── IndexedDB Adapter
├── Supabase Adapter
├── Google Maps Adapter
├── Google Places Adapter
├── File Parser Adapter
└── Photo Storage Adapter
```

## 移行方針

1. 既存挙動を変えず、`ui.js` から機能単位のサービスへ段階的に抽出する。
2. localStorage の既存キーを読み取る互換アダプターを作る。
3. 新 Place モデルへ変換するマイグレーション層を追加する。
4. Project / Channel を導入し、既存データはデフォルト Project に所属させる。
5. Supabase 導入時は localStorage をバックアップ元として扱い、明示的な移行確認を行う。

## データ保存戦略

### 現在

- localStorage
- 写真 Data URL
- ブラウザ単位の保存

### 近未来

- IndexedDB に大きなデータを移動。
- localStorage は設定・軽量インデックス中心にする。
- スキーマバージョンを持たせる。

### 将来

- Supabase Database
- Supabase Auth
- Supabase Storage
- Realtime Sync
- Row Level Security

## 非機能要件

- モバイルファースト。
- 主要操作は3タップ以内。
- 1 Project あたり数千 Place まで快適に表示できる設計。
- CSV インポート失敗時に既存データを破壊しない。
- 権限不備で非公開データが漏れない。
- API キーと課金 API の利用量を管理できる。
