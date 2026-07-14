# smart-map-platform

サラダマップのように店舗を地図上で登録・検索できる、Google Maps JavaScript APIベースのシングルページアプリです。

## 機能

- 現在地取得（ブラウザのGeolocation API）
- 店舗登録（店舗名、カテゴリ、説明、緯度、経度）
- 店舗一覧表示
- 店舗検索（店舗名・カテゴリ・説明）
- Google Map上の店舗マーカー表示
- 複数KMLファイルの同時インポート
- KMLファイルごとのレイヤー管理（表示/非表示、レイヤー別マーカー色）
- 店舗一覧でのKMLレイヤー名表示
- `localStorage`による店舗データ・KMLレイヤーデータ保存
- Google Places検索からのカフェ・飲食店登録
- JPEG写真のExif GPSを使った近隣カフェ・飲食店候補検索と写真付き登録

## Google Maps APIキーの設定

このアプリはGoogle Maps JavaScript APIキーを使います。キーワード検索と写真GPS登録には、同じAPIキーでPlaces Library / Places APIも有効にしてください。ローカル開発とVercel公開で設定方法が異なります。

### ローカル開発の場合

リポジトリ直下の `config.js` にAPIキーを設定します。まず、次のコマンドで `config.js` を作成してください。

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

### Vercel公開の場合

Vercelでは、環境変数 `GOOGLE_MAPS_API_KEY` にGoogle Maps JavaScript APIキーを設定します。`npm run build` の実行時に `dist/config.js` が生成され、静的サイトとして配信されます。

## 起動

このプロジェクトは外部npmパッケージなしで動きます。`config.js` にAPIキーを設定した状態で起動すると、Google Mapが画面左側に表示されます。

```bash
npm run dev
```

ブラウザで表示されたURL（通常は `http://localhost:5173`）を開いてください。

## npm scripts

- `npm run dev`: ローカル開発サーバーを起動します。
- `npm start`: `npm run dev` と同じサーバーを起動します。
- `npm run build`: Vercel向けの静的ファイルを `dist/` に生成します。
- `npm run check`: JavaScript構文チェックと静的ビルド確認を実行します。
- `npm run init:config`: ローカル開発用の `config.js` を作成します。

## 使い方

1. `現在地を取得` を押すと、ブラウザの位置情報許可後に地図が現在地へ移動し、登録フォームに緯度・経度が入ります。
2. 地図上をクリックするか、`地図中心を入力` を押すと、店舗登録フォームへ緯度・経度を入力できます。
3. 店舗名、カテゴリ、説明を入力して `登録する` を押すと、一覧と地図マーカーに反映されます。
4. `店舗検索` にキーワードを入力すると、店舗名・カテゴリ・説明を対象に一覧と地図マーカーを絞り込みます。
5. Google My Mapsなどから書き出したKMLファイルを選ぶと、Placemarkを店舗として取り込めます。ファイル選択画面では、`Ctrl`キー（Macは`command`キー）を押しながら複数ファイルをクリックすると同時に選べます。
6. 取り込んだKMLは「1ファイル = 1レイヤー」として `KMLレイヤー` に表示されます。レイヤー名は、KML内の`Document`名があればそれを使い、なければファイル名を使います。
7. `KMLレイヤー` のチェックを外すと、そのレイヤー由来の店舗が地図と店舗一覧から非表示になります。チェックを戻すと再表示されます。
8. KMLから取り込んだ店舗は、レイヤーごとに違う色の地図マーカーになります。店舗一覧にも色付きのレイヤー名が表示されるため、どのKMLファイル由来か確認できます。
9. `今日行ったカフェを検索登録` に店名やキーワードを入力して候補を検索し、候補の `登録` を押すと、店舗名・カテゴリ・住所・緯度・経度を保存して地図マーカーと店舗一覧に追加します。
10. `写真GPSでカフェ登録` でJPEG写真を選ぶと、Exif GPS付近の既存店舗（50m以内）とGoogle Placesのカフェ・飲食店候補を表示します。既存店舗を選ぶと写真を追加し、Places候補を選ぶと写真付き店舗として新規登録します。GPS情報がない写真は「GPS情報がありません」と表示して未分類に保存します。

## KMLレイヤー機能のポイント（初心者向け）

- **複数ファイルを一度に読み込み**: `KMLインポート` のファイル欄から、Google My Mapsでエクスポートした `.kml` ファイルを複数選べます。
- **レイヤー名の決まり方**: KMLファイル内に地図名（`Document`の`name`）が入っていればその名前、入っていなければ `.kml` を除いたファイル名がレイヤー名になります。
- **色の見分け方**: レイヤーごとに自動で色が割り当てられ、同じレイヤーの店舗は同じ色のマーカーで表示されます。
- **表示/非表示**: `KMLレイヤー` 欄のチェックボックスで、レイヤー単位で地図マーカーと店舗一覧の表示を切り替えられます。
- **保存場所**: ブラウザの `localStorage` に店舗情報とレイヤー情報を保存します。同じブラウザで再度開くと、前回読み込んだ内容が残ります。
- **通常の店舗登録はそのまま**: 手入力で登録した店舗はKMLレイヤーに属さず、従来どおり検索・削除できます。

## Vercelで公開する手順（初心者向け）

1. **Google Maps APIキーを用意する**
   - Google Cloud ConsoleでGoogle Maps JavaScript APIを有効化します。
   - 公開後に使うドメインが決まったら、APIキーのHTTPリファラー制限にVercelのドメインを追加してください。

2. **GitHubなどにリポジトリを置く**
   - VercelはGitHub / GitLab / Bitbucketのリポジトリから簡単にデプロイできます。
   - `config.js` はコミットしないでください。APIキーはVercelの環境変数で設定します。

3. **Vercelでプロジェクトを作成する**
   - Vercelにログインし、`Add New...` → `Project` を選びます。
   - このリポジトリをImportします。
   - Framework Presetは `Other` のままで問題ありません。
   - Build Commandは `npm run build`、Output Directoryは `dist` です。`vercel.json` に設定済みなので通常は自動で反映されます。

4. **環境変数を設定する**
   - Vercelのプロジェクト設定で `Settings` → `Environment Variables` を開きます。
   - Nameに `GOOGLE_MAPS_API_KEY`、ValueにGoogle Maps JavaScript APIキーを入力します。
   - Production / Preview / Development のうち、公開したい環境にチェックを入れて保存します。

5. **デプロイする**
   - `Deploy` を押すか、GitにpushするとVercelが自動で `npm run build` を実行します。
   - デプロイ完了後、表示されたURLを開いて地図が表示されることを確認してください。

6. **APIキー制限を更新する**
   - Vercelの公開URLが確定したら、Google Cloud ConsoleのAPIキー制限に `https://あなたのプロジェクト名.vercel.app/*` を追加します。
   - 独自ドメインを使う場合は、そのドメインもHTTPリファラーに追加します。

## 静的ビルドの確認

Vercelに送る前に、ローカルで次のコマンドを実行すると構文チェックとビルド確認ができます。

```bash
npm run check
```

ビルド成果物は `dist/` に作成されます。`dist/config.js` には環境変数 `GOOGLE_MAPS_API_KEY` の値が書き込まれます。

## Supabaseでチラシ配布データを共有する

チラシ配布データ（`flyerApartments`）だけをSupabaseの `flyer_places` テーブルにも保存できます。店舗データ、サラダデータ、KML/CSV形式、既存のlocalStorageバックアップは変更しません。Supabaseが未設定、または接続に失敗した場合は従来どおりlocalStorageのデータで起動します。

### 接続設定

`config.js` に次の値を設定します。URLクエリの `?supabaseUrl=...&supabaseAnonKey=...` でも一時的に指定できます。

```js
window.SMART_MAP_SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
window.SMART_MAP_SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

Vercelなどで公開する場合は、ビルド後の `dist/config.js` に同等の値を配信するか、公開URLのクエリパラメータで動作確認してください。

### 最小テーブル

最初の動作確認用SQL例です。認証なしで確認できるようにする場合でも、本番運用では必ず認証とRLS（Row Level Security）を設計してください。

```sql
create table if not exists public.flyer_places (
  id text primary key,
  name text not null,
  address text,
  latitude double precision not null,
  longitude double precision not null,
  status text default '未配布',
  assignee text,
  distributed_at date,
  quantity integer,
  memo text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 動作

- 起動時にSupabaseから `flyer_places` を読み込み、localStorageの `smart-map-platform:flyer-apartments` とマージします。
- localStorageに既存のチラシ配布データがある場合、初回起動時にSupabaseへupsertして移行します。
- 配布状況、配布日、担当者、配布枚数、メモ、CSV取り込み後のチラシ配布データはlocalStorageへ保存しつつSupabaseにもupsertします。
- Supabase接続・保存に失敗してもlocalStorageバックアップを使うため、アプリが真っ白にならない設計です。

> **重要:** 今回は動作確認を優先して、認証なしでも使える最小構成にしています。本番運用ではSupabase Authなどの認証、RLSポリシー、書き込み権限の制限、プロジェクトごとのデータ分離を必ず設定してください。
