# Data Model

## 方針

すべての用途を Place 共通モデルで扱い、用途固有情報は `templateId`、`categoryId`、`layerId`、`statusId`、`customFields`、`knowledge`、`history` で拡張します。

Project は最小限の基本情報だけを持ちます。メンバー、レイヤー、カスタム項目、ステータス定義は Project 本体に配列として埋め込まず、独立した型として `projectId` で関連づけます。これにより、Project の肥大化を避け、再インポート、権限、テンプレート、履歴管理を安全に拡張できるようにします。

## Project

Project はテーマ、所有者、公開範囲を表す最上位コンテナです。Project 本体には、配列を持たせません。

```ts
type Project = {
  id: string;
  name: string;
  description: string;
  templateId: string;
  ownerId: string;
  visibility: 'private' | 'invited' | 'link' | 'public';
  createdAt: string;
  updatedAt: string;
};
```

## Template

Template は、チラシ配布、サラダマップ、ダンススタジオ、自由テンプレートなどの初期設定を定義します。Project は `templateId` で Template を参照し、必要に応じて Project 独自の Field / Status / Action 定義で上書き・拡張します。

```ts
type Template = {
  id: string;
  name: string;
  description: string;
  fieldDefinitions: CustomFieldDefinition[];
  statusDefinitions: StatusDefinition[];
  actionDefinitions: ActionDefinition[];
  createdAt: string;
  updatedAt: string;
};
```

```ts
type ActionDefinition = {
  id: string;
  templateId?: string;
  projectId?: string;
  name: string;
  label: string;
  description?: string;
  sortOrder: number;
};
```

## ProjectMember

ProjectMember は Project と User の参加関係を表します。Project に `members` 配列を持たせず、独立したコレクションとして管理します。

```ts
type ProjectMember = {
  id: string;
  projectId: string;
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
};
```

## Layer

Layer は地図上の表示切替、用途別分類、インポート単位を表します。Project に `layers` 配列を持たせず、`projectId` で関連づけます。

```ts
type Layer = {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  color: string;
  visibleByDefault: boolean;
  sourceType?: 'manual' | 'csv' | 'kml' | 'system';
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};
```

## CustomFieldDefinition

CustomFieldDefinition は用途別・Project 別の追加項目を定義します。Template に属する初期定義と Project に属する上書き定義の両方に対応します。

```ts
type CustomFieldDefinition = {
  id: string;
  projectId?: string;
  templateId?: string;
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'attachment' | 'url';
  required: boolean;
  options?: string[];
  defaultValue?: unknown;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};
```

## StatusDefinition

StatusDefinition は Place の状態を定義します。Place 本体には状態名を直接保存せず、`statusId` で StatusDefinition を参照します。

Template 共通の状態は `templateId` で関連づけ、Project 固有の状態は `projectId` で関連づけます。どちらか一方を必須とし、両方が入る場合は Project 側の上書き定義として扱います。

```ts
type StatusDefinition = {
  id: string;
  projectId?: string;
  templateId?: string;
  name: string;
  color: string;
  sortOrder: number;
  isDefault: boolean;
};
```

## Place

Place はすべての地点を表す共通データです。短い固定情報は `summary` に保存し、日付付きの現地メモ、コメント、評価、写真に関する説明などの蓄積情報は Knowledge に保存します。

再インポート時の重複防止と既存状態の維持のため、CSV、KML、Google Places などの由来情報を `source`、`sourceId`、`importBatchId`、`externalProvider`、`externalPlaceId` として持たせます。

削除は物理削除ではなく `deletedAt` によるソフトデリートを基本にします。

```ts
type Place = {
  id: string;
  projectId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  categoryId: string;
  layerId: string;
  statusId: string;
  assigneeId: string | null;
  summary: string;
  tags: string[];
  customFields: Record<string, unknown>;
  source?: 'manual' | 'csv' | 'kml' | 'googlePlaces' | 'photoGps' | 'json' | 'import';
  sourceId?: string;
  importBatchId?: string;
  externalProvider?: 'googlePlaces' | 'googleMaps' | 'myMaps' | 'custom' | string;
  externalPlaceId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  deletedAt?: string | null;
};
```

## Knowledge

Knowledge は Place に紐づく日付付きの現地メモ、コメント、評価、属性更新、要約などの蓄積情報です。添付ファイルは `photos` ではなく Attachment として別管理します。

```ts
type Knowledge = {
  id: string;
  projectId: string;
  placeId: string;
  type: 'comment' | 'rating' | 'tag' | 'field' | 'memo' | 'summary' | 'visit' | 'distribution';
  title?: string;
  body?: string;
  rating?: number;
  tags?: string[];
  customFields?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  deletedAt?: string | null;
};
```

## Attachment

Attachment は画像、動画、音声、PDF などの添付ファイルを統一的に扱う型です。MVP では主に画像を扱いますが、将来拡張として動画、音声、PDF なども同じモデルで扱えるようにします。

`placeId` は Place 直下の添付、`knowledgeId` は Knowledge に紐づく添付を表します。どちらか一方、または用途に応じて両方を持てます。

```ts
type Attachment = {
  id: string;
  projectId: string;
  placeId?: string;
  knowledgeId?: string;
  type: 'image' | 'video' | 'audio' | 'document';
  name: string;
  url?: string;
  dataUrl?: string;
  latitude?: number;
  longitude?: number;
  takenAt?: string;
  createdAt: string;
  createdBy: string;
};
```

## History

History は Place 固定ではなく、Project、Place、Knowledge、Layer、Member など任意のエンティティに対する操作履歴を表します。

```ts
type History = {
  id: string;
  projectId: string;
  entityType: 'project' | 'place' | 'knowledge' | 'layer' | 'member';
  entityId: string;
  action: 'created' | 'updated' | 'statusChanged' | 'visited' | 'distributed' | 'assigneeChanged' | 'attachmentAdded' | 'commentAdded' | 'deleted' | 'restored' | string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  note?: string;
  operatedAt: string;
  operatedBy: string;
};
```

## User

```ts
type User = {
  id: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
};
```

## Permission の扱い

MVP では詳細な Permission 型を実装せず、ProjectMember の `role` で `owner`、`editor`、`viewer` を扱います。

将来は、Project、Layer、Field、Action 単位の詳細な権限を表す Permission / Policy モデルを追加します。

## 既存 localStorage データの移行方針

既存 localStorage データはユーザーの現地活動履歴そのものなので、移行時に削除しません。

### 原則

- 旧データを削除しない。
- 新形式へ一度だけ変換する。
- 移行完了フラグを保存する。
- 失敗時は旧データから復旧できる。
- 同じ CSV の再インポートで既存の状態や履歴を失わない。

### 移行完了フラグ

移行完了後、次のようなキーを保存します。

```text
smart-map-platform:migration:v2:completed = true
```

このフラグが存在する場合、同じ旧データを再度自動変換しません。再移行が必要な場合は、ユーザー確認付きの手動操作として実行します。

### 旧データから新形式への変換

- 既存 `smart-map-platform:stores` はデフォルト Project の Place に変換する。
- 既存 `smart-map-platform:kml-layers` は Layer に変換する。
- 既存 `smart-map-platform:flyer-apartments` はチラシ配布 Project またはチラシ配布 Layer の Place に変換する。
- 既存 `description` は Place `summary` に移し、必要に応じて Knowledge にも初期コメントとして複製する。
- 既存 `memo` は Knowledge の `type = memo` として保存する。
- 既存 `photos` は Attachment の `type = image` として保存する。
- 既存の配布状況文字列は StatusDefinition を作成したうえで `statusId` に変換する。
- 既存の KML / CSV 由来情報は `source`、`sourceId`、`importBatchId` に可能な範囲で補完する。

### 再インポート時の重複防止

CSV、KML、Google Places などを再インポートする場合は、次の優先順位で既存 Place と突合します。

1. `projectId + externalProvider + externalPlaceId`
2. `projectId + source + sourceId`
3. `projectId + importBatchId + sourceId`
4. 正規化した `name + address`
5. 緯度経度が一定距離以内で名称が類似

既存 Place と一致した場合は、配布状況、担当者、Knowledge、Attachment、History を失わず、インポート元の基本情報だけを必要に応じて更新します。

## MVP では実装しないが将来拡張として残すもの

次の概念は MVP では実装しません。ただし、将来の地図プラットフォーム化に備えて設計余地を残します。

- Line: 道路、配布ルート、散策ルートなどの線データ。
- Polygon: エリア、商圏、配布範囲、点検区域などの面データ。
- Entity: Place 以外の抽象的な業務対象。
- Relationship: Place、Entity、User、Project 間の関係性。
- 複数担当者: 1 Place に複数 User / Team を割り当てる機能。
- 動画・音声・PDF: Attachment で表現可能だが MVP では画像中心。
- 詳細な権限: Field、Layer、Action 単位の権限。
- リアルタイム同期: Supabase などを使った複数ユーザー同時編集。

## 変更内容の要約

- Project から `members`、`permissions`、`layers`、`customFields` 配列を分離し、Project 本体を最小構成にしました。
- `templateType` を `templateId` に変更し、Template 型を追加しました。
- Place の `status` を `statusId` に変更し、StatusDefinition 型を追加しました。
- Place の `note` を `summary` に変更し、日付付きメモやコメントは Knowledge に保存する設計にしました。
- `Place.photos`、`Knowledge.photos`、`Photo` 型を廃止し、Attachment 型に統一しました。
- History を `entityType` と `entityId` で対象指定する汎用モデルにしました。
- 再インポートの重複防止に必要な `source`、`sourceId`、`importBatchId`、`externalProvider`、`externalPlaceId` を Place に追加しました。
- Place に `deletedAt` を追加し、ソフトデリートに対応しました。
- 既存 localStorage データを削除しない一度きりの移行方針を明記しました。

## 今後の実装順

1. 既存 localStorage データのバックアップエクスポートを追加する。
2. 移行完了フラグとスキーマバージョンを導入する。
3. Template、StatusDefinition、Layer、CustomFieldDefinition の初期定義を作成する。
4. 既存 `stores`、`flyerApartments`、`kml-layers` を新 Place / Layer / Attachment 形式へ変換するアダプターを実装する。
5. 再インポート時の突合キーを導入し、CSV 再インポートで既存状態と履歴を保持する。
6. Knowledge と History の保存処理を追加する。
7. Project 切替と Template 適用を UI に接続する。
8. Supabase 移行に備えて、localStorage / IndexedDB / Supabase を差し替え可能な Repository 層を用意する。
