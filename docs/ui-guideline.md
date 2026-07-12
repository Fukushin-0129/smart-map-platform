# UI Guideline

## 基本方針

Google Maps を参考にしつつ、コピーではなく Smart Map Platform 独自の UI にします。

## ビジュアル原則

- 白・グレーを基調にする。
- アクセント色は1色を基本にする。
- カードを増やしすぎない。
- 余白を広めにする。
- 文字サイズはスマホで読みやすくする。
- ボタン高さは44px以上。
- 横スクロールは禁止。
- 長いフォームは禁止。
- 詳細はボトムシートまたはモーダルで表示。
- 状態色はテーマごとに設定可能にする。

## レイアウト

### モバイル

- 地図: 70〜95%。
- 検索バー: 上部固定。
- 主要 FAB: 右下。
- 現在地、レイヤー、プロジェクト切替は親指で届く範囲。
- 詳細はボトムシート。

### デスクトップ

- 地図を中央に広く表示。
- 詳細はサイドパネル。
- 管理機能は専用パネルまたはページ。

## 状態色

### チラシ配布

- 未配布: 青 `#2563eb`
- 配布済み: 緑 `#16a34a`
- 配布不可: 赤 `#dc2626`
- 不在: 黄 `#f59e0b`

## コンポーネント

- SearchBar
- ProjectSwitcher
- LayerToggle
- CurrentLocationButton
- AddPlaceButton
- PlaceBottomSheet
- PlaceSidePanel
- StatusQuickActions
- PhotoPicker
- ImportWizard
- ExportDialog
- MemberManager
- CustomFieldEditor

## アクセシビリティ

- 主要ボタンに明確なラベルを付ける。
- 色だけで状態を表現しない。
- フォーカスリングを消さない。
- スクリーンリーダー向けに件数や処理結果を `aria-live` で通知する。
- タップ領域は最低44pxを確保する。
