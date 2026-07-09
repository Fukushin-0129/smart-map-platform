import { CANDIDATE_STORE_METERS, DEFAULT_ASSIGNEES, DEFAULT_CENTER, FLYER_LAYER, FLYER_STATUS_COLORS, FLYER_STATUSES, GOOGLE_MAPS_API_KEY, LAYER_COLORS, NEAR_STORE_METERS } from './constants.js';
import { loadFlyerApartments, loadFlyerAssignees, loadLayers, loadPhotoImports, loadStores, saveFlyerApartments, saveFlyerAssignees, saveLayers, savePhotoImports, saveStores } from './storage.js';
import { distanceMeters, escapeHtml, isValidCoordinate, readFileAsDataUrl } from './utils.js';

let map;
let userMarker;
let infoWindow;
let storeMarkers = [];
let flyerMarkers = [];
let stores = loadStores();
let flyerApartments = loadFlyerApartments();
let flyerAssignees = loadFlyerAssignees();
let layers = loadLayers();
let photoImports = loadPhotoImports();
let currentPosition = null;
let googleMapsPromise = null;
let placesService = null;
let keywordPlaceCandidates = [];
let photoPlaceCandidates = [];

const app = document.querySelector('#app');

app.innerHTML = `
  <header class="hero">
    <div>
      <p class="eyebrow">Smart Map Platform</p>
      <h1>サラダマップ風 店舗登録・検索アプリ</h1>
      <p class="lead">Google Maps JavaScript APIで現在地取得、店舗登録、一覧表示、検索を行えます。</p>
      <p class="api-help">APIキーはローカルでは <code>config.js</code>、Vercelでは環境変数 <code>GOOGLE_MAPS_API_KEY</code> に設定します。</p>
    </div>
    <button id="locateButton" class="primary">現在地を取得</button>
  </header>

  <main class="layout">
    <aside class="panel controls" aria-label="店舗管理">
      <section>
        <h2>店舗登録</h2>
        <form id="storeForm" class="form">
          <label>店舗名<input id="name" name="name" required placeholder="例: Green Salad Tokyo" /></label>
          <label>登録先カテゴリ／レイヤー<select id="categoryLayer" name="categoryLayer"></select></label>
          <label>カテゴリ補足<input id="category" name="category" placeholder="例: サラダ / カフェ / テイクアウト" /></label>
          <label>説明<textarea id="description" name="description" rows="3" placeholder="おすすめメニューや営業時間など"></textarea></label>
          <div class="grid-two">
            <label>緯度<input id="lat" name="lat" type="number" step="any" required /></label>
            <label>経度<input id="lng" name="lng" type="number" step="any" required /></label>
          </div>
          <div class="button-row">
            <button type="button" id="useCenterButton">地図中心を入力</button>
            <button type="submit" class="primary">登録する</button>
          </div>
        </form>
      </section>

      <section>
        <h2>今日行ったカフェを検索登録</h2>
        <div class="place-search">
          <label>店名・キーワード
            <input id="placeSearchInput" placeholder="例: 東京駅 カフェ / 店名" />
          </label>
          <div class="button-row">
            <button type="button" id="placeSearchButton" class="primary">候補を検索</button>
            <button type="button" id="clearPlaceCandidatesButton">候補をクリア</button>
          </div>
          <p id="placeSearchStatus" class="import-status" aria-live="polite"></p>
          <div id="placeCandidates" class="candidate-list"></div>
        </div>
      </section>

      <section>
        <h2>写真GPSでカフェ登録</h2>
        <div class="photo-import">
          <label>写真（複数選択可）
            <input id="photoInput" type="file" accept="image/*,.jpg,.jpeg" multiple />
          </label>
          <p class="hint">JPEG写真のExif GPSから位置を読み取り、近くのカフェ・飲食店候補を検索します。候補を選ぶと写真付きで店舗データに登録します。GPS情報がない写真は未分類に保存します。</p>
          <p id="photoStatus" class="import-status" aria-live="polite"></p>
          <div id="photoReview" class="photo-review"></div>
        </div>
      </section>

      <section>
        <h2>KMLインポート</h2>
        <div class="kml-import">
          <label>Google My MapsのKMLファイル（複数選択可）
            <input id="kmlInput" type="file" accept=".kml,application/vnd.google-earth.kml+xml,application/xml,text/xml" multiple />
          </label>
          <p class="hint">Google My Mapsから書き出した複数のKMLを一度に選ぶと、1ファイル=1レイヤーとして追加します。</p>
          <p id="kmlStatus" class="import-status" aria-live="polite"></p>
        </div>
      </section>

      <section>
        <h2>CSVインポート</h2>
        <div class="csv-import">
          <label>配布済み一覧-表1.csv
            <input id="csvInput" type="file" accept=".csv,text/csv" />
          </label>
          <p class="hint">物件名、住所、エリア、種別、小学校区、戸数、戸数状態、配布日、次回配布、備考、担当者、配布状況、緯度、経度を読み込みます。</p>
          <p id="csvStatus" class="import-status" aria-live="polite"></p>
        </div>
      </section>

      <section>
        <h2>担当者</h2>
        <div class="assignee-grid">
          <input id="assignee1" />
          <input id="assignee2" />
          <input id="assignee3" />
        </div>
        <label>担当者で絞り込み<select id="assigneeFilter"></select></label>
      </section>

      <section>
        <div class="list-header">
          <h2>KMLレイヤー</h2>
          <span id="layerCount" class="badge">0件</span>
        </div>
        <div id="layerList" class="layer-list"></div>
      </section>

      <section>
        <h2>店舗検索</h2>
        <input id="searchInput" class="search" placeholder="店舗名・カテゴリ・説明で検索" />
      </section>

      <section>
        <div class="list-header">
          <h2>店舗一覧</h2>
          <span id="count" class="badge">0件</span>
        </div>
        <div id="storeList" class="store-list"></div>
      </section>

      <section>
        <div class="list-header">
          <h2>チラシ配布一覧</h2>
          <span id="flyerCount" class="badge">0件</span>
        </div>
        <div id="flyerStatusSummary" class="flyer-status-summary" aria-live="polite"></div>
        <div class="flyer-legend"><span class="blue">未配布</span><span class="green">配布済み</span><span class="yellow">要現地確認</span><span class="red">配布対象外</span></div>
        <div id="flyerList" class="store-list"></div>
      </section>
    </aside>

    <section class="panel map-panel" aria-label="地図">
      <div id="map" class="map">
        <div id="mapSetup" class="map-setup" hidden>
          <h2>Google Maps APIキーを設定してください</h2>
          <p><code>npm run init:config</code> を実行し、作成された <code>config.js</code> に取得済みのAPIキーを貼り付けてから再読み込みしてください。</p>
        </div>
      </div>
      <p id="mapStatus" class="status">Google Mapsを読み込み中です。</p>
    </section>
  </main>
`;

const elements = {
  mapStatus: document.querySelector('#mapStatus'),
  mapSetup: document.querySelector('#mapSetup'),
  locateButton: document.querySelector('#locateButton'),
  storeForm: document.querySelector('#storeForm'),
  useCenterButton: document.querySelector('#useCenterButton'),
  searchInput: document.querySelector('#searchInput'),
  placeSearchInput: document.querySelector('#placeSearchInput'),
  placeSearchButton: document.querySelector('#placeSearchButton'),
  clearPlaceCandidatesButton: document.querySelector('#clearPlaceCandidatesButton'),
  placeSearchStatus: document.querySelector('#placeSearchStatus'),
  placeCandidates: document.querySelector('#placeCandidates'),
  photoInput: document.querySelector('#photoInput'),
  photoStatus: document.querySelector('#photoStatus'),
  photoReview: document.querySelector('#photoReview'),
  csvInput: document.querySelector('#csvInput'),
  csvStatus: document.querySelector('#csvStatus'),
  assigneeFilter: document.querySelector('#assigneeFilter'),
  assigneeInputs: [document.querySelector('#assignee1'), document.querySelector('#assignee2'), document.querySelector('#assignee3')],
  kmlInput: document.querySelector('#kmlInput'),
  kmlStatus: document.querySelector('#kmlStatus'),
  layerList: document.querySelector('#layerList'),
  layerCount: document.querySelector('#layerCount'),
  storeList: document.querySelector('#storeList'),
  count: document.querySelector('#count'),
  flyerList: document.querySelector('#flyerList'),
  flyerCount: document.querySelector('#flyerCount'),
  flyerStatusSummary: document.querySelector('#flyerStatusSummary'),
  name: document.querySelector('#name'),
  categoryLayer: document.querySelector('#categoryLayer'),
  category: document.querySelector('#category'),
  description: document.querySelector('#description'),
  lat: document.querySelector('#lat'),
  lng: document.querySelector('#lng'),
};

export async function initializeApp() {
  renderCategoryLayerOptions();
  renderLayerList();
  renderAssignees();
  renderStoreList();
  renderFlyerList();
  renderPhotoReview();
  bindEvents();

  try {
    if (!GOOGLE_MAPS_API_KEY) {
      elements.mapSetup.hidden = false;
    }

    await loadGoogleMaps();
    map = new google.maps.Map(document.querySelector('#map'), {
      center: DEFAULT_CENTER,
      zoom: 13,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });
    infoWindow = new google.maps.InfoWindow();
    placesService = new google.maps.places.PlacesService(map);
    map.addListener('click', (event) => fillCoordinates(event.latLng.lat(), event.latLng.lng()));
    renderMarkers();
    fitMapToVisibleData();
    elements.mapSetup.hidden = true;
    elements.mapStatus.textContent = 'Google Mapを表示しました。地図上をクリックすると登録フォームに緯度・経度を入力できます。';
  } catch (error) {
    elements.mapStatus.textContent = error.message;
    elements.mapStatus.classList.add('error');
    elements.mapSetup.hidden = false;
  }
}

function bindEvents() {
  elements.locateButton.addEventListener('click', locateUser);
  elements.useCenterButton.addEventListener('click', () => {
    if (!map) return;
    const center = map.getCenter();
    fillCoordinates(center.lat(), center.lng());
  });
  elements.searchInput.addEventListener('input', () => {
    renderStoreList();
    renderMarkers();
  });
  elements.photoInput.addEventListener('change', importPhotoFiles);
  elements.placeSearchButton.addEventListener('click', searchPlacesByKeyword);
  elements.placeSearchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      searchPlacesByKeyword();
    }
  });
  elements.clearPlaceCandidatesButton.addEventListener('click', () => {
    keywordPlaceCandidates = [];
    elements.placeSearchStatus.textContent = '';
    renderPlaceCandidates();
  });
  elements.csvInput.addEventListener('change', importCsvFile);
  elements.assigneeFilter.addEventListener('change', () => { renderFlyerList(); renderMarkers(); fitMapToVisibleData(); });
  elements.assigneeInputs.forEach((input, index) => input.addEventListener('change', () => updateAssignee(index, input.value)));
  elements.kmlInput.addEventListener('change', importKmlFiles);
  elements.storeForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(elements.storeForm);
    const store = {
      id: crypto.randomUUID(),
      name: formData.get('name').trim(),
      ...categoryLayerFields(formData.get('categoryLayer'), formData.get('category').trim()),
      description: formData.get('description').trim(),
      lat: Number(formData.get('lat')),
      lng: Number(formData.get('lng')),
      createdAt: new Date().toISOString(),
      photos: [],
    };

    if (!isValidCoordinate(store.lat, store.lng)) {
      alert('緯度は-90〜90、経度は-180〜180の範囲で入力してください。');
      return;
    }

    stores = [store, ...stores];
    saveStores(stores);
    elements.storeForm.reset();
    renderStoreList();
    renderMarkers();
    fitMapToVisibleData();
    focusStore(store.id);
  });
}



async function importPhotoFiles(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  elements.photoStatus.textContent = '写真を読み込んでいます...';
  const stats = { attached: 0, candidates: 0, created: 0, unclassified: 0, errors: [] };
  const results = [];

  try {
    for (const file of files) {
      const result = await importSinglePhoto(file, stats);
      results.push(result);
    }

    saveStores(stores);
    savePhotoImports(photoImports);
    renderStoreList();
    renderPhotoReview();
    renderPlaceCandidates();
    renderMarkers();
    fitMapToVisibleData();
  } finally {
    elements.photoStatus.textContent = formatPhotoImportStatus(stats, results);
    event.target.value = '';
  }
}

async function importSinglePhoto(file, stats) {
  try {
    const dataUrl = await readFileAsDataUrl(file);
    let gps = null;

    try {
      gps = await readExifGps(file);
    } catch (error) {
      if (error instanceof PhotoImportError) throw error;
      console.error('Exif GPSの読み取りに失敗しました。GPSなしとして扱います。', { fileName: file.name, fileType: file.type, error });
    }

    const photo = {
      id: crypto.randomUUID(),
      name: file.name,
      dataUrl,
      importedAt: new Date().toISOString(),
      lat: gps?.lat ?? null,
      lng: gps?.lng ?? null,
    };

    if (!gps) {
      photoImports.unclassified = [photo, ...photoImports.unclassified];
      stats.unclassified += 1;
      return `${file.name}: GPS情報がありません。未分類に保存しました。`;
    }

    const nearest = findNearestStore(gps.lat, gps.lng);
    if (nearest && nearest.distance <= NEAR_STORE_METERS) {
      stores = addPhotoToStore(stores, nearest.store.id, photo);
      stats.attached += 1;
      return `${file.name}: ${Math.round(nearest.distance)}m先の既存店舗「${nearest.store.name}」へ追加しました。`;
    }
    const existingCandidates = findNearbyStores(gps.lat, gps.lng, CANDIDATE_STORE_METERS);
    const placeCandidates = nearest && nearest.distance > CANDIDATE_STORE_METERS ? [] : await searchNearbyFoodPlaces(gps.lat, gps.lng);
    if (!existingCandidates.length && (!nearest || nearest.distance > CANDIDATE_STORE_METERS)) stats.created += 1;
    photoPlaceCandidates = [{
      id: crypto.randomUUID(),
      photo,
      origin: { lat: gps.lat, lng: gps.lng },
      existingCandidates,
      placeCandidates,
    }, ...photoPlaceCandidates];
    stats.candidates += 1;
    return `${file.name}: GPS付近の候補を表示しました。`;
  } catch (error) {
    const message = error instanceof Error ? error.message : '写真の読み込み中に不明なエラーが発生しました。';
    console.error('写真インポートに失敗しました。', { fileName: file.name, fileType: file.type, fileSize: file.size, error });
    stats.errors.push(`${file.name}: ${message}`);
    return `${file.name}: エラー - ${message}`;
  }
}

function formatPhotoImportStatus(stats, results) {
  const summary = `${stats.attached}枚を既存店舗に追加、${stats.candidates}枚を候補表示、${stats.created}件を新規スポット、${stats.unclassified}枚を未分類にしました。`;
  const errorSummary = stats.errors.length ? `エラー: ${stats.errors.length}件。` : '';
  return [summary, errorSummary, ...results].filter(Boolean).join('\n');
}

async function searchPlacesByKeyword() {
  const query = elements.placeSearchInput.value.trim();
  if (!query) {
    elements.placeSearchStatus.textContent = '店名またはキーワードを入力してください。';
    return;
  }
  if (!placesService) {
    elements.placeSearchStatus.textContent = 'Google Placesを読み込めませんでした。APIキーとPlaces APIの有効化を確認してください。';
    return;
  }

  elements.placeSearchStatus.textContent = '候補を検索しています...';
  keywordPlaceCandidates = [];
  renderPlaceCandidates();

  try {
    const center = map?.getCenter();
    const request = {
      query,
      fields: ['place_id', 'name', 'formatted_address', 'geometry', 'types'],
      location: center || undefined,
      radius: center ? 3000 : undefined,
    };
    const results = await textSearchPlaces(request);
    keywordPlaceCandidates = results.map((place) => ({ id: crypto.randomUUID(), place }));
    elements.placeSearchStatus.textContent = results.length ? `${results.length}件の候補が見つかりました。` : '候補が見つかりませんでした。キーワードを変えて再検索してください。';
  } catch (error) {
    elements.placeSearchStatus.textContent = error.message || '候補検索に失敗しました。';
  } finally {
    renderPlaceCandidates();
  }
}

function textSearchPlaces(request) {
  return new Promise((resolve, reject) => {
    placesService.textSearch(request, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK) {
        resolve((results || []).slice(0, 8));
        return;
      }
      if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
        resolve([]);
        return;
      }
      reject(new Error(`Google Places検索に失敗しました（${status}）。`));
    });
  });
}

function searchNearbyFoodPlaces(lat, lng) {
  if (!placesService) return Promise.resolve([]);
  return new Promise((resolve) => {
    placesService.nearbySearch({
      location: new google.maps.LatLng(lat, lng),
      radius: 120,
      keyword: 'cafe restaurant',
      type: 'cafe',
    }, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK || status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
        resolve((results || []).slice(0, 8));
        return;
      }
      console.error('GPS付近のPlaces検索に失敗しました。', status);
      resolve([]);
    });
  });
}

function renderCategoryLayerOptions() {
  const options = categoryLayerOptions();
  elements.categoryLayer.innerHTML = options.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join('');
}

function categoryLayerOptions() {
  return [
    { value: '', label: '未分類' },
    ...layers.map((layer) => ({ value: `layer:${layer.id}`, label: `レイヤー: ${layer.name}` })),
    { value: 'category:野菜メインのカフェ', label: 'カテゴリ: 野菜メインのカフェ' },
    { value: 'category:スーパーマーケット', label: 'カテゴリ: スーパーマーケット' },
    { value: 'category:レストランチェーン', label: 'カテゴリ: レストランチェーン' },
    { value: 'category:カフェ', label: 'カテゴリ: カフェ' },
    { value: 'category:飲食店', label: 'カテゴリ: 飲食店' },
  ];
}

function renderCategoryLayerSelect(name, value = '') {
  return `<label class="candidate-layer-select">登録先カテゴリ／レイヤー<select name="${escapeHtml(name)}">${categoryLayerOptions().map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}</select></label>`;
}

function categoryLayerFields(selectedValue, fallbackCategory = '') {
  const selected = String(selectedValue || '');
  if (selected.startsWith('layer:')) {
    const layer = getLayerById(selected.slice(6));
    if (layer) return { category: layer.name || fallbackCategory || '未分類', layerId: layer.id, layerName: layer.name, layerColor: layer.color };
  }
  if (selected.startsWith('category:')) return { category: selected.slice(9) || '未分類', layerId: null, layerName: '', layerColor: '#16a34a' };
  return { category: fallbackCategory || '未分類', layerId: null, layerName: '', layerColor: '#16a34a' };
}

function renderPlaceCandidates() {
  const keywordItems = keywordPlaceCandidates.map((item) => renderPlaceCandidateCard(item.place, 'keyword', item.id, null)).join('');
  const photoItems = photoPlaceCandidates.map((group) => {
    const existing = group.existingCandidates.map((candidate) => `
      <article class="candidate-card existing">
        <div>
          <strong>既存店舗に追加する: ${escapeHtml(candidate.store.name)}</strong>
          <p>${Math.round(candidate.distance)}m / ${escapeHtml(displayCategoryLayer(candidate.store))}</p>
        </div>
        <button data-attach-photo-place="${group.id}" data-store-id="${candidate.store.id}" class="primary">写真を追加</button>
      </article>`).join('');
    const places = group.placeCandidates.map((place, index) => renderPlaceCandidateCard(place, 'photo', `${group.id}:${index}`, group.id)).join('');
    const fallback = !group.existingCandidates.length && !group.placeCandidates.length
      ? `<article class="candidate-card"><div><p>近くのカフェ・飲食店候補が見つかりませんでした。</p>${renderCategoryLayerSelect(`fallback-layer-${escapeHtml(group.id)}`)}</div><button data-create-photo-spot="${group.id}">写真位置で新規登録</button></article>`
      : '';
    return `<section class="photo-place-group">
      <h3>${escapeHtml(group.photo.name)} の候補</h3>
      <img src="${escapeHtml(group.photo.dataUrl)}" alt="${escapeHtml(group.photo.name)}" />
      ${existing}${places}${fallback}
    </section>`;
  }).join('');

  elements.placeCandidates.innerHTML = [keywordItems, photoItems].filter(Boolean).join('') || '<p class="empty">検索またはGPS付き写真の読み込みで候補が表示されます。</p>';
  elements.placeCandidates.querySelectorAll('[data-register-place]').forEach((button) => {
    button.addEventListener('click', () => registerPlaceCandidate(button.dataset.registerPlace, button.dataset.source, button.dataset.groupId || null, button.closest('.candidate-card')?.querySelector('select')?.value || ''));
  });
  elements.placeCandidates.querySelectorAll('[data-attach-photo-place]').forEach((button) => {
    button.addEventListener('click', () => attachPhotoPlaceCandidate(button.dataset.attachPhotoPlace, button.dataset.storeId));
  });
  elements.placeCandidates.querySelectorAll('[data-create-photo-spot]').forEach((button) => {
    button.addEventListener('click', () => createPhotoFallbackSpot(button.dataset.createPhotoSpot, button.closest('.candidate-card')?.querySelector('select')?.value || ''));
  });
}

function renderPlaceCandidateCard(place, source, id, groupId) {
  const position = normalizePlacePosition(place);
  const nearest = position ? findNearestStore(position.lat, position.lng) : null;
  const mode = nearest && nearest.distance <= NEAR_STORE_METERS ? `既存店舗「${nearest.store.name}」の近く（${Math.round(nearest.distance)}m）` : '新規登録候補';
  return `
    <article class="candidate-card">
      <div>
        <strong>${escapeHtml(place.name || '名称未設定')}</strong>
        <p>${escapeHtml(place.formatted_address || place.vicinity || '住所不明')}</p>
        <small>${escapeHtml(mode)}</small>
        ${renderCategoryLayerSelect(`candidate-layer-${escapeHtml(id)}`)}
      </div>
      <button data-register-place="${escapeHtml(id)}" data-source="${source}" ${groupId ? `data-group-id="${escapeHtml(groupId)}"` : ''} class="primary">登録</button>
    </article>`;
}

function registerPlaceCandidate(id, source, groupId, categoryLayerValue = '') {
  const group = groupId ? photoPlaceCandidates.find((item) => item.id === groupId) : null;
  const place = source === 'keyword'
    ? keywordPlaceCandidates.find((item) => item.id === id)?.place
    : group?.placeCandidates[Number(id.split(':')[1])];
  if (!place) return;
  const photo = group?.photo || null;
  const store = storeFromPlace(place, photo ? [photo] : [], categoryLayerValue);
  if (!store) {
    elements.placeSearchStatus.textContent = '候補の位置情報を取得できないため登録できません。';
    return;
  }
  stores = [store, ...stores];
  if (source === 'keyword') keywordPlaceCandidates = keywordPlaceCandidates.filter((item) => item.id !== id);
  if (group) photoPlaceCandidates = photoPlaceCandidates.filter((item) => item.id !== group.id);
  saveStores(stores);
  renderStoreList();
  renderPlaceCandidates();
  renderMarkers();
  focusStore(store.id);
}

function attachPhotoPlaceCandidate(groupId, storeId) {
  const group = photoPlaceCandidates.find((item) => item.id === groupId);
  if (!group) return;
  stores = addPhotoToStore(stores, storeId, group.photo);
  photoPlaceCandidates = photoPlaceCandidates.filter((item) => item.id !== groupId);
  saveStores(stores);
  renderStoreList();
  renderPlaceCandidates();
  renderMarkers();
  focusStore(storeId);
}

function createPhotoFallbackSpot(groupId, categoryLayerValue = '') {
  const group = photoPlaceCandidates.find((item) => item.id === groupId);
  if (!group) return;
  const store = createPhotoSpot(group.photo, categoryLayerValue);
  stores = [store, ...stores];
  photoPlaceCandidates = photoPlaceCandidates.filter((item) => item.id !== groupId);
  saveStores(stores);
  renderStoreList();
  renderPlaceCandidates();
  renderMarkers();
  focusStore(store.id);
}

function storeFromPlace(place, photos = [], categoryLayerValue = '') {
  const position = normalizePlacePosition(place);
  if (!position) return null;
  return {
    id: crypto.randomUUID(),
    name: place.name || '名称未設定',
    ...categoryLayerFields(categoryLayerValue, categoryFromPlace(place)),
    description: place.formatted_address || place.vicinity || '',
    address: place.formatted_address || place.vicinity || '',
    lat: position.lat,
    lng: position.lng,
    createdAt: new Date().toISOString(),
    googlePlaceId: place.place_id || '',
    photos,
  };
}

function normalizePlacePosition(place) {
  const location = place?.geometry?.location;
  if (!location) return null;
  const lat = typeof location.lat === 'function' ? location.lat() : location.lat;
  const lng = typeof location.lng === 'function' ? location.lng() : location.lng;
  return isValidCoordinate(lat, lng) ? { lat, lng } : null;
}

function categoryFromPlace(place) {
  const types = place.types || [];
  if (types.includes('cafe')) return 'カフェ';
  if (types.includes('restaurant')) return '飲食店';
  if (types.includes('bakery')) return 'ベーカリー';
  return types[0]?.replace(/_/g, ' ') || '未分類';
}

class PhotoImportError extends Error {}

function createPhotoSpot(photo, categoryLayerValue = '') {
  return {
    id: crypto.randomUUID(),
    name: photo.name.replace(/\.(jpe?g)$/i, '') || '写真スポット',
    ...categoryLayerFields(categoryLayerValue, '写真スポット'),
    description: 'GPS付き写真から作成したスポットです。',
    lat: photo.lat,
    lng: photo.lng,
    createdAt: new Date().toISOString(),
    photos: [photo],
  };
}

function addPhotoToStore(storeList, storeId, photo) {
  return storeList.map((store) => store.id === storeId ? { ...store, photos: [photo, ...(store.photos || [])] } : store);
}

function findNearestStore(lat, lng) {
  return stores.reduce((nearest, store) => {
    if (!isValidCoordinate(store.lat, store.lng)) return nearest;
    const distance = distanceMeters(lat, lng, store.lat, store.lng);
    return !nearest || distance < nearest.distance ? { store, distance } : nearest;
  }, null);
}

function findNearbyStores(lat, lng, maxMeters) {
  return stores
    .map((store) => ({ store, distance: isValidCoordinate(store.lat, store.lng) ? distanceMeters(lat, lng, store.lat, store.lng) : Infinity }))
    .filter((candidate) => candidate.distance <= maxMeters)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3);
}

function renderPhotoReview() {
  const candidateItems = photoImports.candidates.map((item) => `
    <article class="photo-review-card">
      <img src="${escapeHtml(item.photo.dataUrl)}" alt="${escapeHtml(item.photo.name)}" />
      <div><strong>${escapeHtml(item.photo.name)}</strong><small>${escapeHtml(item.storeName)} から約${item.distance}m</small></div>
      <button data-attach-candidate="${item.photo.id}">候補店舗に追加</button>
      <button data-create-candidate="${item.photo.id}">新規スポット</button>
    </article>`).join('');
  const unclassifiedItems = photoImports.unclassified.map((photo) => `
    <article class="photo-review-card">
      <img src="${escapeHtml(photo.dataUrl)}" alt="${escapeHtml(photo.name)}" />
      <div><strong>${escapeHtml(photo.name)}</strong><small>GPS情報なし</small></div>
    </article>`).join('');

  elements.photoReview.innerHTML = candidateItems || unclassifiedItems
    ? `${candidateItems ? `<h3>候補写真</h3>${candidateItems}` : ''}${unclassifiedItems ? `<h3>未分類写真</h3>${unclassifiedItems}` : ''}`
    : '';

  elements.photoReview.querySelectorAll('[data-attach-candidate]').forEach((button) => button.addEventListener('click', () => resolveCandidatePhoto(button.dataset.attachCandidate, 'attach')));
  elements.photoReview.querySelectorAll('[data-create-candidate]').forEach((button) => button.addEventListener('click', () => resolveCandidatePhoto(button.dataset.createCandidate, 'create')));
}

function resolveCandidatePhoto(photoId, action) {
  const candidate = photoImports.candidates.find((item) => item.photo.id === photoId);
  if (!candidate) return;
  if (action === 'attach') {
    stores = addPhotoToStore(stores, candidate.storeId, candidate.photo);
  } else {
    stores = [createPhotoSpot(candidate.photo), ...stores];
  }
  photoImports.candidates = photoImports.candidates.filter((item) => item.photo.id !== photoId);
  saveStores(stores);
  savePhotoImports(photoImports);
  renderStoreList();
  renderPhotoReview();
  renderMarkers();
}

async function readExifGps(file) {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  if (view.byteLength < 2 || view.getUint16(0) !== 0xffd8) throw new PhotoImportError('JPEG形式ではありません。');

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset);
    offset += 2;
    if (offset + 2 > view.byteLength) break;
    const length = view.getUint16(offset);
    offset += 2;
    if (length < 2 || offset + length - 2 > view.byteLength) break;
    if (marker === 0xffe1 && length >= 8 && getAscii(view, offset, 6) === 'Exif\0\0') {
      return parseTiffGps(view, offset + 6);
    }
    offset += length - 2;
  }
  return null;
}

function parseTiffGps(view, tiffOffset) {
  if (tiffOffset + 8 > view.byteLength) return null;
  const byteOrder = getAscii(view, tiffOffset, 2);
  if (!['II', 'MM'].includes(byteOrder)) return null;
  const littleEndian = byteOrder === 'II';
  const firstIfdOffset = getUint32(view, tiffOffset + 4, littleEndian);
  if (tiffOffset + firstIfdOffset + 2 > view.byteLength) return null;
  const gpsIfdPointer = findIfdValue(view, tiffOffset + firstIfdOffset, 0x8825, littleEndian, tiffOffset);
  if (!gpsIfdPointer) return null;

  const gpsIfd = tiffOffset + gpsIfdPointer;
  if (gpsIfd + 2 > view.byteLength) return null;
  const latRef = findIfdValue(view, gpsIfd, 0x0001, littleEndian, tiffOffset);
  const latValue = findIfdValue(view, gpsIfd, 0x0002, littleEndian, tiffOffset);
  const lngRef = findIfdValue(view, gpsIfd, 0x0003, littleEndian, tiffOffset);
  const lngValue = findIfdValue(view, gpsIfd, 0x0004, littleEndian, tiffOffset);
  if (!latRef || !latValue || !lngRef || !lngValue) return null;

  const lat = convertGpsCoordinate(latValue, latRef);
  const lng = convertGpsCoordinate(lngValue, lngRef);
  return isValidCoordinate(lat, lng) ? { lat, lng } : null;
}

function findIfdValue(view, ifdOffset, tag, littleEndian, tiffOffset) {
  if (ifdOffset + 2 > view.byteLength) return null;
  const count = getUint16(view, ifdOffset, littleEndian);
  for (let i = 0; i < count; i += 1) {
    const entry = ifdOffset + 2 + i * 12;
    if (entry + 12 > view.byteLength) return null;
    if (getUint16(view, entry, littleEndian) !== tag) continue;
    const type = getUint16(view, entry + 2, littleEndian);
    const values = getUint32(view, entry + 4, littleEndian);
    const valueOffset = values * typeByteSize(type) <= 4 ? entry + 8 : tiffOffset + getUint32(view, entry + 8, littleEndian);
    if (valueOffset < 0 || valueOffset > view.byteLength) return null;
    if (type === 2) return valueOffset + values <= view.byteLength ? getAscii(view, valueOffset, values).replace(/\0/g, '') : null;
    if (type === 5) return Array.from({ length: values }, (_, index) => {
      const rationalOffset = valueOffset + index * 8;
      if (rationalOffset + 8 > view.byteLength) return 0;
      const numerator = getUint32(view, rationalOffset, littleEndian);
      const denominator = getUint32(view, rationalOffset + 4, littleEndian);
      return denominator ? numerator / denominator : 0;
    });
    return getUint32(view, entry + 8, littleEndian);
  }
  return null;
}

function convertGpsCoordinate(parts, ref) {
  if (!Array.isArray(parts) || parts.length < 3) return NaN;
  const value = parts[0] + parts[1] / 60 + parts[2] / 3600;
  return ['S', 'W'].includes(ref.toUpperCase()) ? -value : value;
}

function typeByteSize(type) {
  return { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8 }[type] || 0;
}

function getUint16(view, offset, littleEndian) {
  return view.getUint16(offset, littleEndian);
}

function getUint32(view, offset, littleEndian) {
  return view.getUint32(offset, littleEndian);
}

function getAscii(view, offset, length) {
  return Array.from({ length }, (_, index) => String.fromCharCode(view.getUint8(offset + index))).join('');
}

async function importKmlFiles(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  elements.kmlStatus.textContent = 'KMLファイルを読み込んでいます...';

  const importedStores = [];
  const importedLayers = [];
  const errors = [];

  for (const file of files) {
    try {
      const text = await file.text();
      const layer = createKmlLayer(text, file.name, importedLayers.length);
      const parsedStores = parseKmlStores(text, file.name, layer);
      if (parsedStores.length) {
        importedLayers.push({ ...layer, storeCount: parsedStores.length });
        importedStores.push(...parsedStores);
      } else {
        errors.push(`${file.name}: インポートできるPlacemarkが見つかりませんでした。`);
      }
    } catch (error) {
      errors.push(`${file.name}: ${error.message}`);
    }
  }

  if (importedStores.length) {
    layers = [...importedLayers, ...layers];
    stores = [...importedStores, ...stores];
    saveLayers(layers);
    saveStores(stores);
    renderLayerList();
    renderStoreList();
    renderMarkers();
    fitMapToVisibleData();
  }

  elements.kmlStatus.textContent = [
    importedStores.length ? `${importedLayers.length}レイヤー、${importedStores.length}件の店舗を追加しました。` : '店舗は追加されませんでした。',
    ...errors,
  ].join(' ');
  event.target.value = '';
}

function parseKmlStores(kmlText, fileName, layer) {
  const document = new DOMParser().parseFromString(kmlText, 'application/xml');
  const parserError = document.querySelector('parsererror');
  if (parserError) {
    throw new Error('KMLの形式を確認してください。');
  }

  return getDescendantNodes(document, 'Placemark').map((placemark) => {
    const coordinates = extractPlacemarkCoordinates(placemark);
    if (!coordinates || !isValidCoordinate(coordinates.lat, coordinates.lng)) return null;

    return {
      id: crypto.randomUUID(),
      name: getDirectNodeText(placemark, 'name') || stripFileExtension(fileName),
      category: getPlacemarkLayerName(placemark) || layer.name || '未分類',
      description: normalizeDescription(getDirectNodeText(placemark, 'description')),
      lat: coordinates.lat,
      lng: coordinates.lng,
      createdAt: new Date().toISOString(),
      importedFrom: fileName,
      layerId: layer.id,
      layerName: layer.name,
      layerColor: layer.color,
    };
  }).filter(Boolean);
}

function createKmlLayer(kmlText, fileName, importIndex) {
  const document = new DOMParser().parseFromString(kmlText, 'application/xml');
  const parserError = document.querySelector('parsererror');
  if (parserError) throw new Error('KMLの形式を確認してください。');

  const documentName = getDirectNodeText(getDescendantNodes(document, 'Document')[0] || document.documentElement, 'name');
  const id = crypto.randomUUID();
  return {
    id,
    name: documentName || stripFileExtension(fileName),
    fileName,
    color: nextLayerColor(importIndex),
    visible: true,
    createdAt: new Date().toISOString(),
  };
}

function nextLayerColor(importIndex = 0) {
  return LAYER_COLORS[(layers.length + importIndex) % LAYER_COLORS.length];
}

function extractPlacemarkCoordinates(placemark) {
  const coordinatesText = getDescendantNodeText(placemark, 'coordinates');
  const firstCoordinate = coordinatesText.split(/\s+/).find(Boolean);
  if (!firstCoordinate) return null;

  const [lng, lat] = firstCoordinate.split(',').map(Number);
  return { lat, lng };
}

function getPlacemarkLayerName(placemark) {
  let parent = placemark.parentElement;
  while (parent) {
    if (parent.localName === 'Folder') {
      return getDirectNodeText(parent, 'name');
    }
    parent = parent.parentElement;
  }
  return '';
}

function getDirectNodeText(root, tagName) {
  const node = Array.from(root.children).find((child) => child.localName === tagName);
  return node?.textContent?.trim() || '';
}

function getDescendantNodeText(root, tagName) {
  const node = getDescendantNodes(root, tagName)[0];
  return node?.textContent?.trim() || '';
}

function getDescendantNodes(root, tagName) {
  return Array.from(root.getElementsByTagName('*')).filter((child) => child.localName === tagName);
}

function normalizeDescription(description) {
  if (!description) return '';
  const htmlDocument = new DOMParser().parseFromString(description, 'text/html');
  return (htmlDocument.body.textContent || description).replace(/\s+/g, ' ').trim();
}

function stripFileExtension(fileName) {
  return fileName.replace(/\.kml$/i, '');
}

function loadGoogleMaps() {
  if (!GOOGLE_MAPS_API_KEY) {
    return Promise.reject(new Error('Google Maps JavaScript APIキーを設定してください。ローカルではconfig.js、VercelではGOOGLE_MAPS_API_KEYを使います。'));
  }
  if (window.google?.maps) return Promise.resolve();
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    window.initSmartMap = resolve;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&callback=initSmartMap&libraries=places&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error('Google Maps JavaScript APIの読み込みに失敗しました。APIキーとネットワークを確認してください。'));
    document.head.appendChild(script);
  });
  return googleMapsPromise;
}

function locateUser() {
  if (!navigator.geolocation) {
    alert('このブラウザは現在地取得に対応していません。');
    return;
  }
  elements.mapStatus.textContent = '現在地を取得しています...';
  navigator.geolocation.getCurrentPosition(
    (position) => {
      currentPosition = { lat: position.coords.latitude, lng: position.coords.longitude };
      fillCoordinates(currentPosition.lat, currentPosition.lng);
      if (map) {
        map.setCenter(currentPosition);
        map.setZoom(15);
        userMarker?.setMap(null);
        userMarker = new google.maps.Marker({
          position: currentPosition,
          map,
          title: '現在地',
          icon: { path: google.maps.SymbolPath.CIRCLE, scale: 9, fillColor: '#2563eb', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 3 },
        });
      }
      elements.mapStatus.textContent = '現在地を取得しました。緯度・経度を店舗登録に利用できます。';
    },
    () => {
      elements.mapStatus.textContent = '現在地を取得できませんでした。ブラウザの位置情報許可を確認してください。';
      elements.mapStatus.classList.add('error');
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
  );
}

function renderMarkers() {
  if (!map || !window.google?.maps) return;
  storeMarkers.forEach((marker) => marker.setMap(null));
  flyerMarkers.forEach((marker) => marker.setMap(null));
  storeMarkers = filteredStores().map((store) => {
    const marker = new google.maps.Marker({
      position: { lat: store.lat, lng: store.lng },
      map,
      title: store.name,
      icon: markerIconForStore(store),
    });
    marker.storeId = store.id;
    marker.addListener('click', () => openStoreInfo(store, marker));
    return marker;
  });
  flyerMarkers = filteredFlyerApartments().map((apt) => {
    const marker = new google.maps.Marker({ position: { lat: apt.lat, lng: apt.lng }, map, title: apt.name, icon: markerIconForFlyer(apt) });
    marker.flyerId = apt.id;
    marker.addListener('click', () => openFlyerInfo(apt, marker));
    return marker;
  });
}

function fitMapToVisibleData() {
  if (!map || !window.google?.maps) return;
  const bounds = new google.maps.LatLngBounds();
  let count = 0;
  [...filteredStores(), ...filteredFlyerApartments()].forEach((item) => {
    if (!isValidCoordinate(item.lat, item.lng)) return;
    bounds.extend({ lat: item.lat, lng: item.lng });
    count += 1;
  });
  if (!count) {
    map.setCenter({ lat: 20, lng: 0 });
    map.setZoom(2);
    return;
  }
  if (count === 1) {
    map.setCenter(bounds.getCenter());
    map.setZoom(15);
    return;
  }
  map.fitBounds(bounds, 64);
}

function markerIconForStore(store) {
  const color = store.layerColor || getLayerById(store.layerId)?.color || '#16a34a';
  return { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: color, fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 };
}

function openStoreInfo(store, marker) {
  const photoGrid = renderInfoWindowPhotos(store.photos);
  infoWindow.setContent(`<div class="info-window"><strong>${escapeHtml(store.name)}</strong><br>${escapeHtml(displayCategoryLayer(store))}<br>${escapeHtml(store.description || '説明なし')}${photoGrid}</div>`);
  infoWindow.open({ anchor: marker, map });
}

function renderLayerList() {
  renderCategoryLayerOptions();
  elements.layerCount.textContent = `${layers.length}件`;
  elements.layerList.innerHTML = layers.length
    ? layers.map((layer) => `
      <label class="layer-card">
        <input type="checkbox" data-toggle-layer="${layer.id}" ${layer.visible ? 'checked' : ''} />
        <span class="layer-color" style="--layer-color: ${escapeHtml(layer.color)}"></span>
        <span><strong>${escapeHtml(layer.name)}</strong><small>${escapeHtml(layer.fileName)} / ${countStoresInLayer(layer.id)}件</small></span>
      </label>`).join('')
    : '<p class="empty">KMLを読み込むと、ここでレイヤーの表示/非表示を切り替えられます。</p>';

  elements.layerList.querySelectorAll('[data-toggle-layer]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => toggleLayer(checkbox.dataset.toggleLayer, checkbox.checked));
  });
}

function toggleLayer(layerId, visible) {
  layers = layers.map((layer) => layer.id === layerId ? { ...layer, visible } : layer);
  saveLayers(layers);
  renderStoreList();
  renderMarkers();
  fitMapToVisibleData();
}

function countStoresInLayer(layerId) {
  return stores.filter((store) => store.layerId === layerId).length;
}

function getLayerById(layerId) {
  return layers.find((layer) => layer.id === layerId);
}

function renderStoreList() {
  const visibleStores = filteredStores();
  elements.count.textContent = `${visibleStores.length}件`;
  elements.storeList.innerHTML = visibleStores.length
    ? visibleStores.map((store) => `
      <article class="store-card">
        <div>
          <h3>${escapeHtml(store.name)}</h3>
          <p class="category">${escapeHtml(displayCategoryLayer(store))}</p>
          ${store.layerName ? `<p class="layer-badge"><span style="--layer-color: ${escapeHtml(store.layerColor)}"></span>${escapeHtml(store.layerName)}</p>` : ''}
          <p>${escapeHtml(store.description || '説明なし')}</p>
          <p class="coords">${store.lat.toFixed(6)}, ${store.lng.toFixed(6)}</p>
          ${renderPhotoThumbnails(store.photos)}
        </div>
        <div class="store-actions">
          <button data-focus-store="${store.id}">地図で見る</button>
          <button class="danger" data-delete-store="${store.id}">削除</button>
        </div>
      </article>`).join('')
    : '<p class="empty">条件に一致する店舗がありません。</p>';

  elements.storeList.querySelectorAll('[data-focus-store]').forEach((button) => {
    button.addEventListener('click', () => focusStore(button.dataset.focusStore));
  });

  elements.storeList.querySelectorAll('[data-delete-store]').forEach((button) => {
    button.addEventListener('click', () => deleteStore(button.dataset.deleteStore));
  });
}

function displayCategoryLayer(store) {
  return store.layerName || store.category || '未分類';
}

function renderInfoWindowPhotos(photos = []) {
  return photos.length
    ? `<div class="info-photo-grid">${photos.slice(0, 6).map((photo) => `<img src="${escapeHtml(photo.dataUrl)}" alt="${escapeHtml(photo.name)}" />`).join('')}</div>`
    : '';
}

function renderPhotoThumbnails(photos = []) {
  return photos.length
    ? `<div class="photo-thumbnails">${photos.slice(0, 4).map((photo) => `<img src="${escapeHtml(photo.dataUrl)}" alt="${escapeHtml(photo.name)}" title="${escapeHtml(photo.name)}" />`).join('')}${photos.length > 4 ? `<span>+${photos.length - 4}</span>` : ''}</div>`
    : '';
}

function deleteStore(id) {
  stores = stores.filter((store) => store.id !== id);
  layers = layers.filter((layer) => countStoresInLayer(layer.id) > 0);
  saveStores(stores);
  saveLayers(layers);
  renderLayerList();
  infoWindow?.close();
  renderStoreList();
  renderFlyerList();
  renderMarkers();
}

function focusStore(id) {
  const store = stores.find((item) => item.id === id);
  if (!store || !map) return;
  const position = { lat: store.lat, lng: store.lng };
  map.setCenter(position);
  map.setZoom(16);
  const marker = storeMarkers.find((candidate) => candidate.storeId === store.id);
  if (marker) openStoreInfo(store, marker);
}

function filteredStores() {
  const keyword = elements.searchInput.value.trim().toLowerCase();
  const visibleLayerIds = new Set(layers.filter((layer) => layer.visible).map((layer) => layer.id));
  const layerFilteredStores = stores.filter((store) => !store.layerId || visibleLayerIds.has(store.layerId));
  if (!keyword) return layerFilteredStores;
  return layerFilteredStores.filter((store) => [store.name, store.category, store.description, store.layerName, store.address].some((value) => String(value || '').toLowerCase().includes(keyword)));
}

function fillCoordinates(lat, lng) {
  elements.lat.value = lat.toFixed(6);
  elements.lng.value = lng.toFixed(6);
}

function renderAssignees() {
  const selected = elements.assigneeFilter.value;
  elements.assigneeInputs.forEach((input, index) => { input.value = flyerAssignees[index] || ''; });
  elements.assigneeFilter.innerHTML = '<option value="">すべて</option>' + flyerAssignees.map((name) => `<option value="${escapeHtml(name)}" ${name === selected ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('');
}

function updateAssignee(index, value) {
  flyerAssignees[index] = value.trim() || DEFAULT_ASSIGNEES[index];
  saveFlyerAssignees(flyerAssignees);
  renderAssignees();
  renderFlyerList();
}

async function importCsvFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  elements.csvStatus.textContent = 'CSVを読み込んでいます...';
  try {
    const rows = parseCsv(await file.text());
    const imported = rowsToFlyerApartments(rows);
    flyerApartments = [...imported, ...flyerApartments];
    saveFlyerApartments(flyerApartments);
    renderFlyerList();
    renderMarkers();
    fitMapToVisibleData();
    elements.csvStatus.textContent = `${imported.length}件を「チラシ配布マンション」レイヤーへ追加しました。`;
  } catch (error) {
    elements.csvStatus.textContent = error.message || 'CSVの読み込みに失敗しました。';
  } finally {
    event.target.value = '';
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i], next = text[i + 1];
    if (char === '"' && quoted && next === '"') { value += '"'; i += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === ',' && !quoted) { row.push(value); value = ''; continue; }
    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(value); rows.push(row); row = []; value = ''; continue;
    }
    value += char;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim()));
}

function rowsToFlyerApartments(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim().replace(/^\ufeff/, ''));
  const indexOf = (name) => headers.indexOf(name);
  return rows.slice(1).map((row) => {
    const get = (name) => row[indexOf(name)]?.trim() || '';
    const splitCoord = get('緯度') && !get('経度') && get('緯度').includes(',') ? get('緯度').split(',').map((v) => Number(v.trim())) : null;
    const lat = splitCoord ? splitCoord[0] : Number(get('緯度'));
    const lng = splitCoord ? splitCoord[1] : Number(get('経度'));
    if (!isValidCoordinate(lat, lng)) return null;
    const distributionDate = get('配布日');
    const status = normalizeFlyerStatus(get('配布状況') || get('ステータス') || get('戸数状態'), distributionDate);
    const assignee = normalizeFlyerAssignee(get('担当者') || get('担当'));
    return {
      id: crypto.randomUUID(), layerId: FLYER_LAYER.id, layerName: FLYER_LAYER.name, name: get('物件名') || '名称未設定',
      address: get('住所'), area: get('エリア'), type: get('種別'), schoolDistrict: get('小学校区'), units: get('戸数'), unitStatus: get('戸数状態'),
      distributionDate, nextDistribution: get('次回配布'), memo: get('備考'), lat, lng, status, assignee, photos: [], createdAt: new Date().toISOString(),
    };
  }).filter(Boolean);
}

function normalizeFlyerStatus(unitStatus, distributionDate) {
  const text = `${unitStatus} ${distributionDate}`;
  if (FLYER_STATUSES.includes(unitStatus)) return unitStatus;
  if (/対象外/.test(text)) return '配布対象外';
  if (/確認|要/.test(text)) return '要現地確認';
  if (distributionDate || /済|完了/.test(text)) return '配布済み';
  return '未配布';
}

function normalizeFlyerAssignee(name) {
  const trimmed = String(name || '').trim();
  return flyerAssignees.includes(trimmed) ? trimmed : '';
}

function filteredFlyerApartments() {
  const keyword = elements.searchInput.value.trim().toLowerCase();
  const assignee = elements.assigneeFilter.value;
  return flyerApartments.filter((apt) => (!assignee || apt.assignee === assignee) && (!keyword || [apt.name, apt.address, apt.area, apt.type, apt.schoolDistrict, apt.memo, apt.status, apt.assignee].some((v) => String(v || '').toLowerCase().includes(keyword))));
}

function renderFlyerList() {
  const items = filteredFlyerApartments();
  elements.flyerCount.textContent = `${items.length}件`;
  renderFlyerStatusSummary(items);
  elements.flyerList.innerHTML = items.length ? items.map((apt) => `
    <article class="store-card flyer-card" style="--status-color:${escapeHtml(FLYER_STATUS_COLORS[apt.status] || FLYER_STATUS_COLORS['未配布'])}">
      <div>
        <h3>${escapeHtml(apt.name)}</h3>
        <p class="category">${escapeHtml(FLYER_LAYER.name)} / ${escapeHtml(apt.status)}</p>
        <p>${escapeHtml(apt.address || '住所なし')}</p>
        <p>${escapeHtml([apt.area, apt.type, apt.schoolDistrict, apt.units ? `${apt.units}戸` : ''].filter(Boolean).join(' / '))}</p>
        <p>配布日: ${escapeHtml(apt.distributionDate || '未設定')} / 担当: ${escapeHtml(apt.assignee || '未設定')}</p>
        <p>${escapeHtml(apt.memo || '')}</p>
        ${renderPhotoThumbnails(apt.photos)}
      </div>
      <div class="store-actions">
        <select data-flyer-status="${apt.id}">${FLYER_STATUSES.map((s) => `<option value="${escapeHtml(s)}" ${s === apt.status ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}</select>
        <select data-flyer-assignee="${apt.id}">${['', ...flyerAssignees].map((s) => `<option value="${escapeHtml(s)}" ${s === (apt.assignee || '') ? 'selected' : ''}>${escapeHtml(s || '担当者未設定')}</option>`).join('')}</select>
        <button class="primary" data-complete-flyer="${apt.id}">配布完了</button>
        <label class="photo-button">写真<input type="file" accept="image/*" data-flyer-photo="${apt.id}" hidden></label>
        <button data-focus-flyer="${apt.id}">地図で見る</button>
      </div>
    </article>`).join('') : '<p class="empty">チラシ配布マンションがありません。</p>';
  elements.flyerList.querySelectorAll('[data-complete-flyer]').forEach((button) => button.addEventListener('click', () => completeFlyer(button.dataset.completeFlyer)));
  elements.flyerList.querySelectorAll('[data-focus-flyer]').forEach((button) => button.addEventListener('click', () => focusFlyer(button.dataset.focusFlyer)));
  elements.flyerList.querySelectorAll('[data-flyer-status]').forEach((select) => select.addEventListener('change', () => updateFlyer(select.dataset.flyerStatus, { status: select.value })));
  elements.flyerList.querySelectorAll('[data-flyer-assignee]').forEach((select) => select.addEventListener('change', () => updateFlyer(select.dataset.flyerAssignee, { assignee: select.value })));
  elements.flyerList.querySelectorAll('[data-flyer-photo]').forEach((input) => input.addEventListener('change', () => addFlyerPhoto(input.dataset.flyerPhoto, input.files?.[0])));
}

function renderFlyerStatusSummary(items) {
  const counts = FLYER_STATUSES.reduce((result, status) => ({ ...result, [status]: 0 }), {});
  items.forEach((apt) => { counts[apt.status] = (counts[apt.status] || 0) + 1; });
  elements.flyerStatusSummary.innerHTML = FLYER_STATUSES.map((status) => `
    <span style="--status-color:${escapeHtml(FLYER_STATUS_COLORS[status])}"><strong>${escapeHtml(status)}</strong>${counts[status] || 0}件</span>`).join('');
}

function updateFlyer(id, patch) { flyerApartments = flyerApartments.map((apt) => apt.id === id ? { ...apt, ...patch } : apt); saveFlyerApartments(flyerApartments); renderFlyerList(); renderMarkers(); }
function completeFlyer(id) { const apt = flyerApartments.find((item) => item.id === id); updateFlyer(id, { status: '配布済み', distributionDate: new Date().toISOString().slice(0, 10), assignee: apt?.assignee || flyerAssignees[0] }); }
async function addFlyerPhoto(id, file) { if (!file) return; const photo = { id: crypto.randomUUID(), name: file.name, dataUrl: await readFileAsDataUrl(file), importedAt: new Date().toISOString() }; flyerApartments = flyerApartments.map((apt) => apt.id === id ? { ...apt, photos: [photo, ...(apt.photos || [])] } : apt); saveFlyerApartments(flyerApartments); renderFlyerList(); renderMarkers(); }
function markerIconForFlyer(apt) { return { path: google.maps.SymbolPath.CIRCLE, scale: 9, fillColor: FLYER_STATUS_COLORS[apt.status] || FLYER_STATUS_COLORS['未配布'], fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 }; }
function openFlyerInfo(apt, marker) { infoWindow.setContent(`<div class="info-window"><strong>${escapeHtml(apt.name)}</strong><br>${escapeHtml(FLYER_LAYER.name)}<br>${escapeHtml(apt.status)} / ${escapeHtml(apt.assignee || '担当者未設定')}<br>${escapeHtml(apt.address || '')}${renderInfoWindowPhotos(apt.photos)}</div>`); infoWindow.open({ anchor: marker, map }); }
function focusFlyer(id) { const apt = flyerApartments.find((item) => item.id === id); if (!apt || !map) return; map.setCenter({ lat: apt.lat, lng: apt.lng }); map.setZoom(16); const marker = flyerMarkers.find((item) => item.flyerId === id); if (marker) openFlyerInfo(apt, marker); }
