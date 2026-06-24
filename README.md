# smart-map-platform

サラダマップのように店舗を地図上で登録・検索できる、Google Maps JavaScript APIベースのシングルページアプリです。

## 機能

- 現在地取得（ブラウザのGeolocation API）
- 店舗登録（店舗名、カテゴリ、説明、緯度、経度）
- 店舗一覧表示
- 店舗検索（店舗名・カテゴリ・説明）
- Google Map上の店舗マーカー表示
- `localStorage`による店舗データ保存

## Google Maps APIキーの設定場所

APIキーは、リポジトリ直下の `config.js` に設定します。

まず、次のコマンドで `config.js` を作成してください。

```bash
npm run init:config
```

手動で作る場合は、次のコピーでも構いません。

```bash
cp config.example.js config.js
```

次に、`config.js` を開いて、取得済みのGoogle Maps JavaScript APIキーに置き換えます。

```js
window.SMART_MAP_GOOGLE_MAPS_API_KEY = 'ここに取得済みのAPIキーを貼り付けてください';
```

`config.js` は `.gitignore` に含めているため、APIキーを誤ってGitにコミットしにくい構成です。

一時的な動作確認だけなら、URLに `?googleMapsApiKey=取得済みのAPIキー` を付けても起動できます。

## 起動

このプロジェクトは外部npmパッケージなしで動きます。`config.js` にAPIキーを設定した状態で起動すると、Google Mapが画面左側に表示されます。

```bash
npm run dev
```

ブラウザで表示されたURL（通常は `http://localhost:5173`）を開いてください。

## 使い方

1. `現在地を取得` を押すと、ブラウザの位置情報許可後に地図が現在地へ移動し、登録フォームに緯度・経度が入ります。
2. 地図上をクリックするか、`地図中心を入力` を押すと、店舗登録フォームへ緯度・経度を入力できます。
3. 店舗名、カテゴリ、説明を入力して `登録する` を押すと、一覧と地図マーカーに反映されます。
4. `店舗検索` にキーワードを入力すると、店舗名・カテゴリ・説明を対象に一覧と地図マーカーを絞り込みます。
