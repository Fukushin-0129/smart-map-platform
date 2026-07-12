# Product Specification

## 概要

Smart Map Platform は、Project / Channel ごとに場所データ、知識、履歴、権限、レイヤー、カスタム項目を管理する汎用地図プラットフォームです。

## Project / Channel

テーマごとにデータ・メンバー・権限・表示項目を分けます。

### 属性

- `id`
- `name`
- `description`
- `templateType`
- `ownerId`
- `members`
- `permissions`
- `visibility`
- `layers`
- `customFields`
- `createdAt`
- `updatedAt`

### 公開範囲

- 非公開
- 招待者のみ
- リンクを知っている人
- 一般公開

### 権限

- オーナー: すべての設定、削除、メンバー管理、課金管理が可能。
- 編集者: Place、Knowledge、History を作成・更新できる。
- 閲覧者: 許可されたデータを閲覧できる。

## Place

すべての地点は Place として共通管理します。用途別テンプレートは Place の `customFields` と Layer / Category で表現します。

### 必須項目

- `id`
- `projectId`
- `name`
- `address`
- `latitude`
- `longitude`
- `category`
- `layerId`
- `status`
- `assigneeId`
- `note`
- `tags`
- `photos`
- `createdAt`
- `updatedAt`
- `createdBy`
- `updatedBy`

### 任意項目

- `rating`
- `phone`
- `website`
- `openingHours`
- `visitDate`
- `nextVisitDate`
- `customFields`
- `source`
- `externalPlaceId`

## Knowledge

Place に紐づく知識情報です。

- コメント
- 評価
- 写真
- タグ
- 現地メモ
- 属性情報
- テーマ別の知識

## History

Place または Project に紐づく操作履歴です。

- 状態変更
- 訪問履歴
- 配布履歴
- 更新履歴
- 担当者変更
- 写真追加
- コメント追加
- 操作日時
- 操作者

## Layer

Layer は地図上の表示切替、用途別分類、インポート単位を表します。

- `id`
- `projectId`
- `name`
- `description`
- `color`
- `visibleByDefault`
- `sortOrder`
- `sourceType`
- `createdAt`
- `updatedAt`

## MVP 範囲

### 共通 MVP

- プロジェクト切替
- Place 共通管理
- Google Maps 表示
- CSV インポート
- CSV エクスポート
- マーカー表示
- 状態変更
- localStorage 保存
- スマホ最適化
- レイヤー表示切替

### 初期テンプレート

- チラシ配布
- サラダマップ

## 将来範囲

- Supabase 認証と同期
- 複数ユーザー編集
- リアルタイム同期
- 権限管理
- 写真ストレージ
- 操作履歴
- AI ルート最適化
- テンプレート販売
