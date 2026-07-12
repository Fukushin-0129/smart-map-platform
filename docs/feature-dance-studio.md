# Feature: ダンススタジオ

## 目的

ダンススタジオを地図上で共有し、床材、鏡、音響、更衣室、料金、タップ可否などの現地情報を蓄積します。

## 項目

- スタジオ名。
- 床材。
- 鏡。
- 音響。
- 更衣室。
- 利用料金。
- タップ可能か。
- バレエ向きか。
- 写真。
- 予約 URL。
- コメント。

## Place customFields 例

```json
{
  "floorMaterial": "リノリウム",
  "hasMirror": true,
  "soundSystem": "Bluetooth対応",
  "hasChangingRoom": true,
  "price": "1時間 3,000円",
  "tapAvailable": false,
  "balletSuitable": true,
  "reservationUrl": "https://example.com/reserve"
}
```

## UX

- 現在地周辺のスタジオを検索。
- タップ可、バレエ向き、料金帯などで絞り込み。
- 写真とコメントをボトムシートで閲覧。
- 予約 URL へ遷移。

## MVP 以降

初期 MVP ではなく、チラシ配布とサラダマップの共通基盤が安定した後にテンプレートとして追加します。
