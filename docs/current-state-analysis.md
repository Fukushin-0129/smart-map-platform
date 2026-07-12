# 現状分析

## 現在実装済みの機能

Smart Map Platform は、現時点では Google Maps JavaScript API を利用した単一ページアプリです。主な実装済み機能は次の通りです。

- 現在地取得と地図中心への反映。
- 地図クリックまたは地図中心座標による店舗登録。
- 店舗名、カテゴリ、説明、緯度、経度を持つ店舗データの登録・検索・削除。
- Google Maps マーカーと InfoWindow による店舗表示。
- Google Places テキスト検索からのカフェ・飲食店候補登録。
- JPEG Exif GPS を利用した写真位置の読み取り、近隣店舗への写真追加、Places 候補からの写真付き登録。
- 複数 KML ファイルのインポート、KML ごとのレイヤー化、表示・非表示切替、レイヤー別マーカー色。
- チラシ配布 CSV の読み込み、物件マーカー表示、配布状況・担当者・配布日による絞り込み。
- チラシ配布状況の更新、写真追加、詳細パネル編集、配布実績 CSV 出力。
- 未配布物件を2人に分ける簡易ルート候補作成。
- localStorage による店舗、KML レイヤー、レイヤー表示状態、写真取込、チラシ配布、担当者の保存。

## 現在のファイル構成

```text
smart-map-platform/
├── README.md
├── config.example.js
├── index.html
├── package.json
├── server.mjs
├── vercel.json
├── scripts/
│   ├── build.mjs
│   └── init-config.mjs
└── src/
    ├── main.js
    ├── styles.css
    └── modules/
        ├── constants.js
        ├── csvImport.js
        ├── flyerManager.js
        ├── gpsImport.js
        ├── kmlImport.js
        ├── mapManager.js
        ├── saladMap.js
        ├── storage.js
        ├── ui.js
        └── utils.js
```

`csvImport.js`、`flyerManager.js`、`gpsImport.js`、`kmlImport.js`、`mapManager.js`、`saladMap.js` は、将来の分割先として予約された空モジュールです。実処理の大半は `src/modules/ui.js` に集約されています。

## 現在のデータ形式

### 店舗データ

店舗データは `stores` 配列として保持されます。代表的な項目は次の通りです。

- `id`
- `name`
- `category`
- `description`
- `lat`
- `lng`
- `address`
- `placeId`
- `layerId`
- `layerName`
- `photos`
- `createdAt`

KML 由来の店舗は `layerId` と `layerName` を持ち、Google Places 由来の店舗は住所や `placeId` を持ちます。

### KML レイヤー

KML レイヤーは次のような情報を持ちます。

- `id`
- `name`
- `fileName`
- `color`
- `createdAt`

### 写真データ

写真は Data URL として保持されます。

- `id`
- `name`
- `dataUrl`
- `lat`
- `lng`
- `importedAt`

### チラシ配布データ

チラシ配布物件は CSV 行から生成され、代表的に次の項目を持ちます。

- `id`
- `no`
- `name`
- `address`
- `area`
- `type`
- `schoolDistrict`
- `units`
- `lat`
- `lng`
- `status`
- `assignee`
- `distributionDate`
- `distributedCount`
- `memo`
- `photos`
- `createdAt`
- `updatedAt`

## localStorage キー

現在利用している localStorage キーは次の通りです。

| キー | 用途 |
| --- | --- |
| `smart-map-platform:stores` | 店舗データ |
| `smart-map-platform:flyer-apartments` | チラシ配布物件データ |
| `smart-map-platform:kml-layers` | KML レイヤー定義 |
| `smart-map-platform:layer-visibility` | レイヤー表示状態 |
| `smart-map-platform:photo-imports` | 写真取込の候補・未分類データ |
| `smart-map-platform:flyer-assignees` | チラシ配布担当者リスト |

## KML 処理

- 複数 KML ファイルを同時選択できます。
- 1ファイルを1レイヤーとして扱います。
- レイヤー名は KML の `Document > name` を優先し、なければファイル名を使います。
- `Placemark` から名称、説明、座標を抽出して店舗データへ変換します。
- 座標がない Placemark は取り込み対象外です。
- レイヤーごとに色を割り当てます。

## CSV 処理

- 現在の CSV 処理はチラシ配布用です。
- 「No.」「物件名」「エリア」などを含む見出し行を自動検出します。
- タイトル行・集計行が含まれる CSV を想定しています。
- CSV の簡易パーサーを内製しています。
- 既存物件と突合し、写真・ステータス・担当者などの保存済み情報をできるだけ維持します。
- 配布実績 CSV を UTF-8 BOM 付きでエクスポートします。

## 写真 GPS 処理

- JPEG の APP1 Exif セグメントを読み取り、TIFF IFD から GPS 緯度・経度を抽出します。
- GPS 付き写真は近隣店舗検索、近隣 Places 検索、写真位置での新規登録に利用できます。
- GPS なし写真は未分類として保存されます。
- 画像本体は Data URL として localStorage に保存されるため、容量上限に注意が必要です。

## チラシ配布処理

- 配布状況は `未配布`、`配布済み`、`配布不可`、`不在` の4種類です。
- 担当者は最大10名の入力欄を持ちます。
- 配布状況、担当者、配布日で絞り込めます。
- 物件ごとに配布状況、担当者、配布日、配布枚数、メモ、写真を編集できます。
- `配布済み` のクイック操作時は当日の日付を配布日に設定します。
- 2人向けルートは未配布物件を緯度順に分割し、各グループ内を最近傍法で並べ替える簡易実装です。

## 技術的負債

- UI、地図、CSV、KML、写真、Places、チラシ配布の処理が `ui.js` に集中している。
- 汎用 Place / Project / Knowledge / History モデルが未整備。
- localStorage のスキーマバージョンやマイグレーションがない。
- 写真を Data URL で localStorage に保存しており、容量制限に到達しやすい。
- CSV パーサーが内製で、文字コード、巨大ファイル、複雑な引用符処理の検証が不足している。
- Google Maps API キーや Places 利用量に対するガードレールが少ない。
- 認証、権限、監査ログ、共有、リアルタイム同期が未実装。
- テストコードがなく、`npm run check` は構文チェックとビルド確認が中心。
- レスポンシブ UX は存在するが、Google Maps 風の地図主役 UX への再設計余地が大きい。

## 今後のリスク

- 汎用化前に用途別ロジックが増えると、データモデルの分離が困難になる。
- localStorage の既存データを壊す破壊的変更が発生しやすい。
- 写真・KML・CSV の大容量化でブラウザ保存容量や描画性能の問題が出る。
- 権限設計なしで共有機能を追加すると、データ漏えいリスクが高い。
- Places API、Maps API、ルート API の課金管理が販売時の原価リスクになる。

## 再利用可能な機能

- Google Maps の読み込みと地図初期化。
- マーカー表示、InfoWindow、表示範囲調整。
- KML から地点を取り込む処理。
- Google Places 検索から地点を登録する処理。
- Exif GPS 読み取り処理。
- チラシ配布の状態管理と CSV 出力。
- localStorage のロード・保存関数。
- 距離計算、HTML エスケープ、ファイル Data URL 化ユーティリティ。

## 仕様書との差分

- Project / Channel が未実装で、すべてのデータが単一空間に保存される。
- Place 共通モデルが未整備で、店舗とチラシ配布物件が別配列になっている。
- Knowledge / History が未実装。
- 権限、メンバー、公開範囲が未実装。
- Layer は KML とチラシ配布で部分的に存在するが、Project 配下の正式概念ではない。
- AI 機能は未実装。現在の2人ルートは AI ではなく簡易アルゴリズム。
- CSV インポートは汎用列マッピングではなく、特定フォーマット寄り。
- Supabase、認証、写真ストレージ、リアルタイム同期は未実装。
- Google Maps 風の地図主役 UX には未到達で、フォーム・一覧が常時表示されている。
