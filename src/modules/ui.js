import { CANDIDATE_STORE_METERS, DEFAULT_ASSIGNEES, DEFAULT_CENTER, DEFAULT_ZOOM, FLYER_LAYER, FLYER_STATUS_COLORS, FLYER_STATUSES, GOOGLE_MAPS_API_KEY, LAYER_COLORS, NEAR_STORE_METERS } from './constants.js';
import { loadDisplayMode, loadFlyerApartments, loadFlyerAssignees, loadLayers, loadLayerVisibility, loadMapView, loadPhotoImports, loadStores, saveDisplayMode, saveFlyerApartments, saveFlyerAssignees, saveLayers, saveLayerVisibility, saveMapView, savePhotoImports, saveStores } from './storage.js';
import { distanceMeters, escapeHtml, isValidCoordinate, readFileAsDataUrl } from './utils.js';

let map;
let userMarker;
let infoWindow;
let storeMarkers = [];
let flyerMarkers = [];
let stores = loadStores();
let flyerApartments = loadFlyerApartments().map((apt) => ({ ...apt, status: normalizeFlyerStatus(apt.status, apt.distributionDate) }));
let flyerAssignees = loadFlyerAssignees();
let layers = loadLayers();
let layerVisibility = loadLayerVisibility();
let photoImports = loadPhotoImports();
let currentPosition = null;
let googleMapsPromise = null;
let placesService = null;
let keywordPlaceCandidates = [];
let photoPlaceCandidates = [];
let flyerRoutes = [];

const DISPLAY_MODES = [
  { id: 'all', label: 'すべて表示' },
  { id: 'salad', label: 'サラダマップ' },
  { id: 'flyer', label: 'チラシ配布' },
];
let displayMode = normalizeDisplayMode(loadDisplayMode());
let openPlaceDetailRef = null;

const app = document.querySelector('#app');

app.innerHTML = `
  <main class="app-shell">
    <section class="map-stage" aria-label="地図中心の通常画面">
      <div id="map" class="map">
        <div id="mapSetup" class="map-setup" hidden>
          <h2>Google Maps APIキーを設定してください</h2>
          <p><code>npm run init:config</code> を実行し、作成された <code>config.js</code> に取得済みのAPIキーを貼り付けてから再読み込みしてください。</p>
        </div>
      </div>

      <div class="map-topbar" aria-label="地図検索">
        <button type="button" id="menuButton" class="icon-button menu-button" aria-label="メニューを開く" aria-expanded="false">☰</button>
        <label class="map-search-label">
          <span class="visually-hidden">店舗検索</span>
          <input id="searchInput" class="map-search-input" placeholder="店舗名・カテゴリ・説明で検索" autocomplete="off" />
        </label>
      </div>

      <div id="searchResultsPanel" class="search-results-panel" hidden></div>

      <div class="map-actions" aria-label="地図操作">
        <button id="locateButton" class="map-action-button" type="button">現在地</button>
        <div class="fab-group">
          <button id="addFabButton" class="add-fab" type="button" aria-haspopup="true" aria-expanded="false">＋</button>
          <div id="addFabMenu" class="add-fab-menu" hidden>
            <button type="button" data-open-panel="store">店舗を登録</button>
            <button type="button" data-locate-and-open="store">現在地から登録</button>
            <button type="button" data-open-panel="photo">写真GPSから登録</button>
            <button type="button" data-open-panel="csv">CSVインポート</button>
          </div>
        </div>
      </div>

      <p id="mapStatus" class="status map-status">Google Mapsを読み込み中です。</p>
      <div id="appToast" class="app-toast" role="status" aria-live="polite" hidden></div>
      <aside id="placeDetailPanel" class="place-detail-panel" aria-live="polite" hidden></aside>
    </section>

    <div id="drawerBackdrop" class="drawer-backdrop" hidden></div>
    <aside id="managementDrawer" class="management-drawer" aria-label="管理メニュー" aria-hidden="true">
      <div class="drawer-header">
        <div>
          <p class="drawer-eyebrow">Smart Map Platform</p>
          <h1 id="managementPanelTitle">レイヤー</h1>
        </div>
        <button type="button" id="closeDrawerButton" class="icon-button" aria-label="メニューを閉じる">×</button>
      </div>

      <section class="display-mode-menu" aria-label="表示モード">
        <p class="display-mode-label">表示中:</p>
        <p id="currentDisplayMode" class="current-display-mode"></p>
        <h2>表示モード</h2>
        <div class="display-mode-options">
          ${DISPLAY_MODES.map((mode) => `
            <label class="display-mode-option">
              <input type="radio" name="displayMode" value="${mode.id}" />
              <span>${mode.label}</span>
            </label>`).join('')}
        </div>
      </section>

      <nav class="drawer-menu" aria-label="管理機能">
        <button type="button" data-open-panel="layers">レイヤー</button>
        <button type="button" data-open-panel="store">店舗登録</button>
        <button type="button" data-open-panel="csv">CSVインポート</button>
        <button type="button" data-open-panel="csv-export">CSVエクスポート</button>
        <button type="button" data-open-panel="kml">KMLインポート</button>
        <button type="button" data-open-panel="photo">写真GPS</button>
        <button type="button" data-open-panel="assignees">担当者管理</button>
        <button type="button" data-open-panel="flyer">チラシ配布管理</button>
        <button type="button" data-open-panel="settings">設定</button>
      </nav>

      <div class="drawer-content panel controls">
        <section data-panel="layers">
          <div class="list-header">
            <h2>KMLレイヤー</h2>
            <span id="layerCount" class="badge">0件</span>
          </div>
          <div id="layerList" class="layer-list"></div>
        </section>

        <section data-panel="store">
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

        <section data-panel="photo">
          <h2>写真GPSでカフェ登録</h2>
          <div class="photo-import">
            <label>写真（複数選択可）
              <input id="photoInput" type="file" accept="image/*,.jpg,.jpeg" multiple />
            </label>
            <p class="hint">JPEG写真のExif GPSから位置を読み取り、近くのカフェ・飲食店候補を検索します。候補を選ぶと写真付きで店舗データに登録します。GPS情報がない写真は未分類に保存します。</p>
            <p id="photoStatus" class="import-status" aria-live="polite"></p>
            <div id="photoReview" class="photo-review"></div>
          </div>

          <hr class="panel-divider" />
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

        <section data-panel="kml">
          <h2>KMLインポート</h2>
          <div class="kml-import">
            <label>Google My MapsのKMLファイル（複数選択可）
              <input id="kmlInput" type="file" accept=".kml,application/vnd.google-earth.kml+xml,application/xml,text/xml" multiple />
            </label>
            <p class="hint">Google My Mapsから書き出した複数のKMLを一度に選ぶと、1ファイル=1レイヤーとして追加します。</p>
            <p id="kmlStatus" class="import-status" aria-live="polite"></p>
          </div>
        </section>

        <section data-panel="csv">
          <h2>CSVインポート</h2>
          <div class="csv-import">
            <label>配布済み一覧-表1.csv
              <input id="csvInput" type="file" accept=".csv,text/csv" />
            </label>
            <p class="hint">タイトル行・集計行を含むCSVでも、「No.」「物件名」「エリア」から始まる見出し行を自動判定して読み込みます。</p>
            <p id="csvStatus" class="import-status" aria-live="polite"></p>
          </div>
        </section>

        <section data-panel="csv-export">
          <h2>CSVエクスポート</h2>
          <p class="hint">現在の絞り込み条件に一致するチラシ配布実績をCSVで出力します。</p>
          <button type="button" id="exportFlyerCsvButton" class="primary flyer-route-button">配布実績をCSV出力</button>
        </section>

        <section data-panel="assignees">
          <h2>担当者</h2>
          <div class="assignee-grid">
            ${Array.from({ length: 10 }, (_, index) => `<input id="assignee${index + 1}" placeholder="担当${index + 1}" />`).join('')}
          </div>
          <label>担当者で絞り込み<select id="assigneeFilter"></select></label>
          <label>配布状況で絞り込み<select id="flyerStatusFilter"></select></label>
          <label>配布日で絞り込み<input id="flyerDateFilter" type="date" /></label>
          <div class="button-row quick-filter-row">
            <button type="button" id="showUndeliveredButton">未配布のみ</button>
            <button type="button" id="showDeliveredButton">配布済みのみ</button>
          </div>
          <button type="button" id="clearFlyerFiltersButton">絞り込み解除</button>
        </section>

        <section data-panel="flyer">
          <div class="list-header">
            <h2>チラシ配布一覧</h2>
            <span id="flyerCount" class="badge">0件</span>
          </div>
          <div id="flyerStatusSummary" class="flyer-status-summary" aria-live="polite"></div>
          <div class="flyer-legend"><span class="blue">未配布</span><span class="green">配布済み</span><span class="red">配布不可</span><span class="yellow">不在</span></div>
          <button type="button" id="createTwoPersonRouteButton" class="primary flyer-route-button">2人でルート作成</button>
          <div id="flyerRouteList" class="flyer-route-list"></div>
          <div id="flyerList" class="store-list"></div>
        </section>

        <section data-panel="settings">
          <h2>設定</h2>
          <p class="empty">設定項目は今後の段階で整理します。既存のデータ保存、CSV、KML、写真GPS、チラシ配布の処理は変更していません。</p>
        </section>

        <section data-panel="stores">
          <div class="list-header">
            <h2>店舗一覧</h2>
            <span id="count" class="badge">0件</span>
          </div>
          <div id="storeList" class="store-list"></div>
        </section>
      </div>
    </aside>
  </main>
  <div id="flyerDetailPanel" class="flyer-detail-panel" hidden></div>
`;

const elements = {
  mapStatus: document.querySelector('#mapStatus'),
  appToast: document.querySelector('#appToast'),
  mapSetup: document.querySelector('#mapSetup'),
  menuButton: document.querySelector('#menuButton'),
  closeDrawerButton: document.querySelector('#closeDrawerButton'),
  drawerBackdrop: document.querySelector('#drawerBackdrop'),
  managementDrawer: document.querySelector('#managementDrawer'),
  managementPanelTitle: document.querySelector('#managementPanelTitle'),
  currentDisplayMode: document.querySelector('#currentDisplayMode'),
  displayModeInputs: Array.from(document.querySelectorAll('[name="displayMode"]')),
  addFabButton: document.querySelector('#addFabButton'),
  addFabMenu: document.querySelector('#addFabMenu'),
  searchResultsPanel: document.querySelector('#searchResultsPanel'),
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
  flyerStatusFilter: document.querySelector('#flyerStatusFilter'),
  flyerDateFilter: document.querySelector('#flyerDateFilter'),
  showUndeliveredButton: document.querySelector('#showUndeliveredButton'),
  showDeliveredButton: document.querySelector('#showDeliveredButton'),
  clearFlyerFiltersButton: document.querySelector('#clearFlyerFiltersButton'),
  exportFlyerCsvButton: document.querySelector('#exportFlyerCsvButton'),
  assigneeInputs: Array.from({ length: 10 }, (_, index) => document.querySelector(`#assignee${index + 1}`)),
  kmlInput: document.querySelector('#kmlInput'),
  kmlStatus: document.querySelector('#kmlStatus'),
  layerList: document.querySelector('#layerList'),
  layerCount: document.querySelector('#layerCount'),
  storeList: document.querySelector('#storeList'),
  count: document.querySelector('#count'),
  flyerList: document.querySelector('#flyerList'),
  flyerCount: document.querySelector('#flyerCount'),
  flyerStatusSummary: document.querySelector('#flyerStatusSummary'),
  createTwoPersonRouteButton: document.querySelector('#createTwoPersonRouteButton'),
  flyerRouteList: document.querySelector('#flyerRouteList'),
  flyerDetailPanel: document.querySelector('#flyerDetailPanel'),
  placeDetailPanel: document.querySelector('#placeDetailPanel'),
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
  renderDisplayModeMenu();
  bindEvents();

  try {
    if (!GOOGLE_MAPS_API_KEY) {
      elements.mapSetup.hidden = false;
    }

    await loadGoogleMaps();
    map = new google.maps.Map(document.querySelector('#map'), {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });
    infoWindow = new google.maps.InfoWindow();
    placesService = new google.maps.places.PlacesService(map);
    map.addListener('click', (event) => fillCoordinates(event.latLng.lat(), event.latLng.lng()));
    renderMarkers();
    restoreMapViewOrFitVisibleData();
    map.addListener('idle', saveCurrentMapView);
    elements.mapSetup.hidden = true;
    elements.mapStatus.textContent = 'Google Mapを表示しました。地図上をクリックすると、メニュー内の店舗登録フォームに緯度・経度を入力できます。';
  } catch (error) {
    elements.mapStatus.textContent = error.message;
    elements.mapStatus.classList.add('error');
    elements.mapSetup.hidden = false;
  }
}


const panelTitles = {
  layers: 'レイヤー',
  store: '店舗登録',
  csv: 'CSVインポート',
  'csv-export': 'CSVエクスポート',
  kml: 'KMLインポート',
  photo: '写真GPS',
  assignees: '担当者管理',
  flyer: 'チラシ配布管理',
  settings: '設定',
  stores: '店舗一覧',
};

function openManagementDrawer(panelName = 'layers') {
  setActivePanel(panelName);
  elements.managementDrawer.classList.add('open');
  elements.managementDrawer.setAttribute('aria-hidden', 'false');
  elements.drawerBackdrop.hidden = false;
  elements.menuButton.setAttribute('aria-expanded', 'true');
}

function closeManagementDrawer() {
  elements.managementDrawer.classList.remove('open');
  elements.managementDrawer.setAttribute('aria-hidden', 'true');
  elements.drawerBackdrop.hidden = true;
  elements.menuButton.setAttribute('aria-expanded', 'false');
}

function setActivePanel(panelName) {
  const target = panelTitles[panelName] ? panelName : 'layers';
  elements.managementPanelTitle.textContent = panelTitles[target];
  document.querySelectorAll('[data-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.panel !== target;
  });
  document.querySelectorAll('.drawer-menu [data-open-panel]').forEach((button) => {
    button.classList.toggle('active', button.dataset.openPanel === target);
  });
}

function toggleAddMenu() {
  const nextHidden = !elements.addFabMenu.hidden;
  elements.addFabMenu.hidden = nextHidden;
  elements.addFabButton.setAttribute('aria-expanded', String(!nextHidden));
}

function closeAddMenu() {
  elements.addFabMenu.hidden = true;
  elements.addFabButton.setAttribute('aria-expanded', 'false');
}

function bindEvents() {
  elements.menuButton.addEventListener('click', () => openManagementDrawer('layers'));
  elements.closeDrawerButton.addEventListener('click', closeManagementDrawer);
  elements.drawerBackdrop.addEventListener('click', closeManagementDrawer);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeManagementDrawer();
      closeAddMenu();
      closePlaceDetail();
    }
  });
  document.querySelectorAll('[data-open-panel]').forEach((button) => {
    button.addEventListener('click', () => {
      openManagementDrawer(button.dataset.openPanel);
      closeAddMenu();
    });
  });
  document.querySelectorAll('[data-locate-and-open]').forEach((button) => {
    button.addEventListener('click', () => {
      locateUser();
      openManagementDrawer(button.dataset.locateAndOpen);
      closeAddMenu();
    });
  });
  elements.displayModeInputs.forEach((input) => input.addEventListener('change', () => setDisplayMode(input.value)));
  elements.addFabButton.addEventListener('click', () => toggleAddMenu());
  elements.locateButton.addEventListener('click', locateUser);
  elements.useCenterButton.addEventListener('click', () => {
    if (!map) return;
    const center = map.getCenter();
    fillCoordinates(center.lat(), center.lng());
  });
  elements.searchInput.addEventListener('input', () => {
    renderStoreList();
    renderMarkers();
    closeHiddenPlaceDetail();
  });
  elements.searchInput.addEventListener('focus', () => renderSearchResults());
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
  elements.createTwoPersonRouteButton.addEventListener('click', createTwoPersonRoutes);
  elements.exportFlyerCsvButton.addEventListener('click', exportFlyerCsv);
  const rerenderFlyerFilters = () => { flyerRoutes = []; renderFlyerRoutes(); renderFlyerList(); renderMarkers(); fitMapToVisibleData(); };
  elements.assigneeFilter.addEventListener('change', rerenderFlyerFilters);
  elements.flyerStatusFilter.addEventListener('change', rerenderFlyerFilters);
  elements.flyerDateFilter.addEventListener('change', rerenderFlyerFilters);
  elements.showUndeliveredButton.addEventListener('click', () => { elements.flyerStatusFilter.value = '未配布'; rerenderFlyerFilters(); });
  elements.showDeliveredButton.addEventListener('click', () => { elements.flyerStatusFilter.value = '配布済み'; rerenderFlyerFilters(); });
  elements.clearFlyerFiltersButton.addEventListener('click', () => { elements.assigneeFilter.value = ''; elements.flyerStatusFilter.value = ''; elements.flyerDateFilter.value = ''; rerenderFlyerFilters(); });
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
    fitMapToVisibleData({ items: [store] });
    focusStore(store.id);
  });
}



async function importPhotoFiles(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  elements.photoStatus.textContent = '写真を読み込んでいます...';
  const stats = { attached: 0, candidates: 0, created: 0, unclassified: 0, errors: [] };
  const results = [];
  const previousCandidateIds = new Set(photoPlaceCandidates.map((group) => group.id));

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
    const importedOrigins = photoPlaceCandidates.filter((group) => !previousCandidateIds.has(group.id)).map((group) => group.origin);
    fitMapToVisibleData({ items: importedOrigins });
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
    fitMapToVisibleData({ items: importedStores });
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

  storeMarkers = visibleStorePlaces().map((store) => {
    const marker = new google.maps.Marker({
      position: { lat: store.lat, lng: store.lng },
      map,
      title: store.name,
      icon: markerIconForStore(store),
      clickable: true,
      optimized: false,
    });
    marker.storeId = store.id;
    bindPlaceMarkerClick(marker, () => {
      const latestStore = stores.find((item) => item.id === marker.storeId) || store;
      openStoreInfo(latestStore, marker);
    });
    return marker;
  });

  flyerMarkers = visibleFlyerPlaces().map((apt) => {
    const marker = new google.maps.Marker({
      position: { lat: apt.lat, lng: apt.lng },
      map,
      title: apt.name,
      icon: markerIconForFlyer(apt),
      clickable: true,
      optimized: false,
    });
    marker.flyerId = apt.id;
    bindPlaceMarkerClick(marker, () => {
      const latestApartment = flyerApartments.find((item) => item.id === marker.flyerId) || apt;
      openFlyerInfo(latestApartment, marker);
    });
    return marker;
  });
}

function bindPlaceMarkerClick(marker, openDetail) {
  let lastOpenedAt = 0;
  const handleOpen = (event) => {
    event?.domEvent?.stopPropagation?.();
    event?.domEvent?.preventDefault?.();
    const now = Date.now();
    if (now - lastOpenedAt < 250) return;
    lastOpenedAt = now;
    openDetail();
  };
  marker.addListener('click', handleOpen);
  marker.addListener('mouseup', handleOpen);
}

function normalizeDisplayMode(value) {
  return DISPLAY_MODES.some((mode) => mode.id === value) ? value : 'all';
}

function displayModeLabel(modeId = displayMode) {
  return DISPLAY_MODES.find((mode) => mode.id === modeId)?.label || DISPLAY_MODES[0].label;
}

function renderDisplayModeMenu() {
  elements.currentDisplayMode.textContent = displayModeLabel();
  elements.displayModeInputs.forEach((input) => {
    input.checked = input.value === displayMode;
    input.closest('.display-mode-option')?.classList.toggle('active', input.checked);
  });
}

function setDisplayMode(nextMode) {
  displayMode = normalizeDisplayMode(nextMode);
  saveDisplayMode(displayMode);
  renderDisplayModeMenu();
  renderStoreList();
  renderFlyerList();
  renderFlyerRoutes();
  renderLayerList();
  renderMarkers();
  closeHiddenPlaceDetail();
  fitMapToVisibleData();
}

function restoreMapViewOrFitVisibleData() {
  const savedView = normalizeSavedMapView(loadMapView());
  if (savedView) {
    map.setCenter({ lat: savedView.lat, lng: savedView.lng });
    map.setZoom(savedView.zoom);
    return;
  }
  fitMapToVisibleData();
}

function fitMapToVisibleData(options = {}) {
  if (!map || !window.google?.maps) return;
  const sourceItems = Array.isArray(options.items) ? options.items : [...visibleStorePlaces(), ...visibleFlyerPlaces()];
  const { validItems, invalidCount, reversedCount } = validFitBoundsItems(sourceItems);
  if (reversedCount) {
    console.warn('緯度経度が逆転している可能性があります', { count: reversedCount });
    showToast('緯度経度が逆転している可能性があります');
  }
  if (invalidCount) showToast(`${invalidCount}件の地点は座標異常のため地図表示対象外です`);

  if (!validItems.length) {
    map.setCenter(DEFAULT_CENTER);
    map.setZoom(DEFAULT_ZOOM);
    return;
  }

  if (validItems.length === 1) {
    map.setCenter({ lat: Number(validItems[0].lat), lng: Number(validItems[0].lng) });
    map.setZoom(15);
    return;
  }

  const bounds = new google.maps.LatLngBounds();
  validItems.forEach((item) => bounds.extend({ lat: Number(item.lat), lng: Number(item.lng) }));
  map.fitBounds(bounds, 64);
}

function validFitBoundsItems(items) {
  return items.reduce((result, item) => {
    const lat = Number(item?.lat);
    const lng = Number(item?.lng);
    if (isReversedJapanCoordinateCandidate(lat, lng)) result.reversedCount += 1;
    if (!isSafeFitCoordinate(lat, lng)) {
      result.invalidCount += 1;
      return result;
    }
    result.validItems.push({ ...item, lat, lng });
    return result;
  }, { validItems: [], invalidCount: 0, reversedCount: 0 });
}

function isSafeFitCoordinate(lat, lng) {
  return Number.isFinite(lat)
    && Number.isFinite(lng)
    && lat >= -90 && lat <= 90
    && lng >= -180 && lng <= 180
    && !(lat === 0 && lng === 0)
    && lat >= 20 && lat <= 46
    && lng >= 122 && lng <= 154;
}

function isReversedJapanCoordinateCandidate(lat, lng) {
  return Number.isFinite(lat)
    && Number.isFinite(lng)
    && lat >= 122 && lat <= 154
    && lng >= 20 && lng <= 46;
}

function normalizeSavedMapView(view) {
  const lat = Number(view?.lat);
  const lng = Number(view?.lng);
  const zoom = Number(view?.zoom);
  if (!isGlobalMapCoordinate(lat, lng) || !Number.isFinite(zoom)) return null;
  return { lat, lng, zoom: Math.min(21, Math.max(3, Math.round(zoom))) };
}

function isGlobalMapCoordinate(lat, lng) {
  return Number.isFinite(lat)
    && Number.isFinite(lng)
    && lat >= -90 && lat <= 90
    && lng >= -180 && lng <= 180
    && !(lat === 0 && lng === 0);
}

function saveCurrentMapView() {
  if (!map) return;
  const center = map.getCenter();
  if (!center) return;
  const lat = center.lat();
  const lng = center.lng();
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  saveMapView({ lat, lng, zoom: map.getZoom() ?? DEFAULT_ZOOM, updatedAt: new Date().toISOString() });
}

function showToast(message) {
  if (!elements.appToast) return;
  elements.appToast.textContent = message;
  elements.appToast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { elements.appToast.hidden = true; }, 3200);
}

function markerIconForStore(store) {
  const color = store.layerColor || getLayerById(store.layerId)?.color || '#16a34a';
  return { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: color, fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 };
}

function openStoreInfo(store, marker) {
  openPlaceDetailRef = { type: 'store', id: store.id };
  openPlaceDetail(renderStoreDetailCard(store), store.name);
  if (marker?.getPosition && map) map.panTo(marker.getPosition());
}


function openPlaceDetail(content, title = 'Place詳細') {
  infoWindow?.close();
  closeAddMenu();
  elements.searchResultsPanel.hidden = true;
  elements.flyerDetailPanel.hidden = true;
  elements.placeDetailPanel.classList.remove('expanded');
  elements.placeDetailPanel.innerHTML = content;
  elements.placeDetailPanel.hidden = false;
  elements.placeDetailPanel.querySelector('[data-close-place-detail]')?.addEventListener('click', closePlaceDetail);
  bindFlyerDetailControls(elements.placeDetailPanel);
  elements.placeDetailPanel.querySelector('[data-place-sheet-handle]')?.addEventListener('click', () => {
    elements.placeDetailPanel.classList.toggle('expanded');
  });
  elements.placeDetailPanel.setAttribute('aria-label', `${title}の詳細`);
}

function closePlaceDetail() {
  openPlaceDetailRef = null;
  elements.placeDetailPanel.hidden = true;
  elements.placeDetailPanel.classList.remove('expanded');
  elements.placeDetailPanel.innerHTML = '';
}

function renderStoreDetailCard(store) {
  const rows = renderDetailRows([
    ['名称', store.name],
    ['住所', store.address],
    ['カテゴリ', store.category],
    ['状態', store.status],
    ['担当者', store.assignee],
    ['メモ', store.memo || store.note],
    ['評価', store.rating],
    ['説明', store.description],
  ]);
  return renderPlaceDetailShell({
    typeLabel: displayCategoryLayer(store),
    title: store.name || '名称未設定',
    summary: store.address || store.description || displayCategoryLayer(store),
    body: `${rows}${renderDetailPhotos(store.photos)}`,
  });
}

function renderFlyerDetailCard(apt) {
  const currentStatus = normalizeFlyerStatus(apt.status, apt.distributionDate);
  const statusColor = FLYER_STATUS_COLORS[currentStatus] || FLYER_STATUS_COLORS['未配布'];
  const activeAssignees = flyerAssignees.filter((name) => String(name || '').trim());
  const rows = renderDetailRows([
    ['住所', apt.address],
    ['エリア', apt.area],
    ['種別', apt.type],
    ['小学校区', apt.schoolDistrict],
    ['緯度', formatCoordinate(apt.lat)],
    ['経度', formatCoordinate(apt.lng)],
    ['No.', apt.no],
  ]);
  return renderPlaceDetailShell({
    typeLabel: FLYER_LAYER.name,
    title: apt.name || '物件名未設定',
    summary: [apt.address, `現在の配布状況: ${currentStatus}`].filter(Boolean).join(' / '),
    body: `
      <section class="flyer-detail-card" data-flyer-detail-card="${escapeHtml(apt.id)}" style="--status-color:${escapeHtml(statusColor)}">
        <p class="flyer-current-status"><span>現在の配布状況</span><strong>${escapeHtml(currentStatus)}</strong></p>
        <div class="flyer-status-buttons flyer-detail-status-buttons" aria-label="配布状況を変更">
          ${FLYER_STATUSES.map((status) => {
            const selected = status === currentStatus;
            return `<button type="button" data-detail-set-flyer-status="${escapeHtml(status)}" data-flyer-id="${escapeHtml(apt.id)}" class="flyer-status-button ${selected ? 'selected' : ''}" style="--status-color:${escapeHtml(FLYER_STATUS_COLORS[status])}" aria-pressed="${selected}">${escapeHtml(status)}${selected ? '（選択中）' : ''}</button>`;
          }).join('')}
        </div>
        <div class="flyer-detail-fields">
          ${apt.units ? `<div class="flyer-readonly-field"><span>戸数</span><strong>${escapeHtml(apt.units)}戸</strong></div>` : ''}
          <label>配布枚数<input name="deliveredCount" type="number" min="0" step="1" inputmode="numeric" value="${escapeHtml(apt.deliveredCount ?? '')}" data-flyer-detail-input="deliveredCount" /></label>
          <label>配布日<input name="distributionDate" type="date" value="${escapeHtml(apt.distributionDate || (currentStatus === '配布済み' ? todayString() : ''))}" data-flyer-detail-input="distributionDate" /></label>
          ${activeAssignees.length ? `<label>担当者<select name="assignee" data-flyer-detail-input="assignee"><option value="">担当者未設定</option>${activeAssignees.map((name) => `<option value="${escapeHtml(name)}" ${name === (apt.assignee || '') ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')}</select></label>` : ''}
          <label>メモ<textarea name="memo" rows="4" data-flyer-detail-input="memo">${escapeHtml(apt.memo || '')}</textarea></label>
        </div>
        ${rows}
      </section>`,
  });
}

function renderPlaceDetailShell({ typeLabel, title, summary, body }) {
  return `
    <div class="place-sheet-handle" data-place-sheet-handle aria-hidden="true"></div>
    <div class="place-detail-header">
      <div>
        ${typeLabel ? `<p class="place-detail-eyebrow">${escapeHtml(typeLabel)}</p>` : ''}
        <h2>${escapeHtml(title)}</h2>
        ${summary ? `<p>${escapeHtml(summary)}</p>` : ''}
      </div>
      <button type="button" data-close-place-detail aria-label="詳細を閉じる">×</button>
    </div>
    <div class="place-detail-body">${body}</div>`;
}

function renderDetailRows(rows) {
  const html = rows.filter(([, value]) => hasDetailValue(value)).map(([label, value]) => `
    <div class="place-detail-row">
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(String(value))}</dd>
    </div>`).join('');
  return html ? `<dl class="place-detail-list">${html}</dl>` : '<p class="empty">表示できる詳細情報がありません。</p>';
}

function renderDetailPhotos(photos = []) {
  return photos.length ? `<div class="place-detail-photos">${photos.slice(0, 6).map((photo) => `<img src="${escapeHtml(photo.dataUrl)}" alt="${escapeHtml(photo.name || '写真')}" />`).join('')}</div>` : '';
}

function hasDetailValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function formatCoordinate(value) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(6) : '';
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ja-JP');
}

function renderLayerList() {
  renderCategoryLayerOptions();
  const displayLayers = visibleLayerControls();
  elements.layerCount.textContent = `${displayLayers.length}件`;
  elements.layerList.innerHTML = displayLayers.length
    ? displayLayers.map((layer) => `
      <label class="layer-card">
        <input type="checkbox" data-toggle-layer="${escapeHtml(layer.id)}" ${isLayerVisible(layer.id) ? 'checked' : ''} />
        <span class="layer-color" style="--layer-color: ${escapeHtml(layer.color)}"></span>
        <span><strong>${escapeHtml(layer.name)}（${layer.count}件）</strong><small>${escapeHtml(layer.detail)}</small></span>
      </label>`).join('')
    : '<p class="empty">KMLやチラシ配布CSVを読み込むと、ここでレイヤーの表示/非表示を切り替えられます。</p>';

  elements.layerList.querySelectorAll('[data-toggle-layer]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => toggleLayer(checkbox.dataset.toggleLayer, checkbox.checked));
  });
}

function visibleLayerControls() {
  return [
    { id: FLYER_LAYER.id, name: FLYER_LAYER.name, color: FLYER_LAYER.color, detail: 'CSVレイヤー', count: flyerApartments.length },
    { id: 'default-stores', name: 'サラダマップ・店舗', color: '#16a34a', detail: '通常店舗レイヤー', count: stores.filter((store) => !store.layerId).length },
    ...layers.map((layer) => ({ id: layer.id, name: layer.name, color: layer.color, detail: layer.fileName || 'KMLレイヤー', count: countStoresInLayer(layer.id) })),
  ];
}

function toggleLayer(layerId, visible) {
  layerVisibility = { ...layerVisibility, [layerId]: visible };
  if (layerId !== FLYER_LAYER.id) {
    layers = layers.map((layer) => layer.id === layerId ? { ...layer, visible } : layer);
    saveLayers(layers);
  }
  saveLayerVisibility(layerVisibility);
  renderLayerList();
  renderStoreList();
  renderFlyerList();
  renderMarkers();
  fitMapToVisibleData();
}

function isLayerVisible(layerId) {
  if (typeof layerVisibility[layerId] === 'boolean') return layerVisibility[layerId];
  if (layerId === FLYER_LAYER.id) return FLYER_LAYER.visible;
  if (layerId === 'default-stores') return true;
  const layer = getLayerById(layerId);
  return layer?.visible !== false;
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

  renderSearchResults(visibleStores);
}

function renderSearchResults(visibleStores = filteredStores()) {
  const keyword = elements.searchInput.value.trim();
  if (!keyword) {
    elements.searchResultsPanel.hidden = true;
    elements.searchResultsPanel.innerHTML = '';
    return;
  }

  const previewStores = visibleStores.slice(0, 5);
  elements.searchResultsPanel.hidden = false;
  elements.searchResultsPanel.innerHTML = previewStores.length
    ? `<div class="search-results-header"><strong>${escapeHtml(keyword)}</strong><span>${visibleStores.length}件</span></div>
      ${previewStores.map((store) => `
        <button type="button" class="search-result-item" data-focus-store="${escapeHtml(store.id)}">
          <span>${escapeHtml(store.name)}</span>
          <small>${escapeHtml(displayCategoryLayer(store))}</small>
        </button>`).join('')}
      <button type="button" class="search-results-more" data-open-panel="stores">店舗一覧で見る</button>`
    : '<p class="empty">条件に一致する店舗がありません。</p>';

  elements.searchResultsPanel.querySelectorAll('[data-focus-store]').forEach((button) => {
    button.addEventListener('click', () => {
      focusStore(button.dataset.focusStore);
      elements.searchResultsPanel.hidden = true;
    });
  });
  elements.searchResultsPanel.querySelector('[data-open-panel="stores"]')?.addEventListener('click', () => openManagementDrawer('stores'));
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
  closePlaceDetail();
  stores = stores.filter((store) => store.id !== id);
  layers = layers.filter((layer) => countStoresInLayer(layer.id) > 0);
  saveStores(stores);
  saveLayers(layers);
  renderLayerList();
  infoWindow?.close();
  renderStoreList();
  renderFlyerList();
  renderFlyerRoutes();
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

function visibleStorePlaces() {
  return filteredStores().filter((store) => isValidCoordinate(store.lat, store.lng));
}

function visibleFlyerPlaces() {
  return filteredFlyerApartments().filter((apt) => isValidCoordinate(apt.lat, apt.lng));
}

function isSaladRelatedStore(store) {
  if (!store.layerId) return true;
  const layer = getLayerById(store.layerId);
  const haystack = [store.layerName, store.category, store.description, layer?.name, layer?.fileName].join(' ').toLowerCase();
  return haystack.includes('サラダ') || haystack.includes('salad');
}

function closeHiddenPlaceDetail() {
  if (!openPlaceDetailRef) return;
  const visible = openPlaceDetailRef.type === 'store'
    ? visibleStorePlaces().some((store) => store.id === openPlaceDetailRef.id)
    : visibleFlyerPlaces().some((apt) => apt.id === openPlaceDetailRef.id);
  if (!visible) closePlaceDetail();
}

function filteredStores() {
  const keyword = elements.searchInput.value.trim().toLowerCase();
  const visibleLayerIds = new Set(layers.filter((layer) => isLayerVisible(layer.id)).map((layer) => layer.id));
  const defaultStoresVisible = isLayerVisible('default-stores');
  const modeFilteredStores = displayMode === 'flyer' ? [] : stores.filter((store) => displayMode === 'all' || isSaladRelatedStore(store));
  const layerFilteredStores = modeFilteredStores.filter((store) => store.layerId ? visibleLayerIds.has(store.layerId) : defaultStoresVisible);
  if (!keyword) return layerFilteredStores;
  return layerFilteredStores.filter((store) => [store.name, store.category, store.description, store.layerName, store.address].some((value) => String(value || '').toLowerCase().includes(keyword)));
}

function fillCoordinates(lat, lng) {
  elements.lat.value = lat.toFixed(6);
  elements.lng.value = lng.toFixed(6);
}

function renderAssignees() {
  const selected = elements.assigneeFilter.value;
  flyerAssignees = [...flyerAssignees, ...DEFAULT_ASSIGNEES].slice(0, 10);
  elements.assigneeInputs.forEach((input, index) => { input.value = flyerAssignees[index] || ''; });
  const activeAssignees = flyerAssignees.filter((name) => String(name || '').trim());
  elements.flyerStatusFilter.innerHTML = '<option value="">すべて</option>' + FLYER_STATUSES.map((status) => `<option value="${escapeHtml(status)}">${escapeHtml(status)}</option>`).join('');
  elements.assigneeFilter.innerHTML = '<option value="">すべて</option>' + activeAssignees.map((name) => `<option value="${escapeHtml(name)}" ${name === selected ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('');
}

function updateAssignee(index, value) {
  flyerAssignees[index] = value.trim() || DEFAULT_ASSIGNEES[index] || '';
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
    const importedOnly = rowsToFlyerApartments(rows);
    flyerApartments = mergeFlyerApartments(importedOnly);
    saveFlyerApartments(flyerApartments);
    renderLayerList();
    renderFlyerList();
    renderMarkers();
    fitMapToVisibleData({ items: importedOnly });
    elements.csvStatus.textContent = `${importedOnly.length}件を「チラシ配布」レイヤーとして読み込みました。保存済み実績は同じ物件に引き継ぎました。`;
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
  const headerIndex = rows.findIndex((row) => row.map((cell) => cell.trim().replace(/^\ufeff/, '')).slice(0, 3).join('|') === 'No.|物件名|エリア');
  if (headerIndex < 0) throw new Error('「No.」「物件名」「エリア」から始まる見出し行が見つかりませんでした。');
  const headers = rows[headerIndex].map((h) => h.trim().replace(/^\ufeff/, ''));
  const indexOf = (...names) => names.map((name) => headers.indexOf(name)).find((index) => index >= 0) ?? -1;
  const importedAt = new Date().toISOString();
  const imported = rows.slice(headerIndex + 1).map((row) => {
    const get = (...names) => row[indexOf(...names)]?.trim() || '';
    const coordText = get('緯度・経度', '緯度経度', '座標');
    const latText = get('緯度', 'lat', 'latitude') || coordText;
    const lngText = get('経度', 'lng', 'lon', 'longitude');
    const splitCoord = latText && !lngText && latText.includes(',') ? latText.split(',').map((v) => Number(v.trim())) : null;
    const lat = splitCoord ? splitCoord[0] : Number(latText);
    const lng = splitCoord ? splitCoord[1] : Number(lngText);
    if (!isValidCoordinate(lat, lng)) return null;
    const distributionDate = get('配布日');
    const no = get('No.', 'No', '番号');
    const name = get('物件名', '建物名', 'マンション名', '名称') || '名称未設定';
    const saved = findSavedFlyer(no, name, lat, lng);
    const status = normalizeFlyerStatus(get('配布状況', 'ステータス', '戸数状態'), distributionDate);
    return {
      id: saved?.id || crypto.randomUUID(),
      no,
      layerId: FLYER_LAYER.id,
      layerName: FLYER_LAYER.name,
      name,
      area: get('エリア'),
      type: get('種別'),
      schoolDistrict: get('小学校区'),
      units: get('戸数'),
      unitStatus: get('戸数状態'),
      distributionDate: saved?.distributionDate || distributionDate || '',
      nextDistribution: get('次回配布'),
      memo: saved?.memo || get('備考', 'メモ'),
      lat,
      lng,
      status: saved?.status || status,
      assignee: saved?.assignee || normalizeFlyerAssignee(get('担当者', '担当')),
      deliveredCount: saved?.deliveredCount || get('配布枚数') || '',
      photos: saved?.photos || [],
      createdAt: saved?.createdAt || importedAt,
      updatedAt: saved?.updatedAt,
    };
  }).filter(Boolean);
  return imported;
}

function mergeFlyerApartments(imported) {
  const importedKeys = new Set(imported.map(flyerMatchKey));
  return [...imported, ...flyerApartments.filter((apt) => !importedKeys.has(flyerMatchKey(apt)))];
}

function flyerMatchKey(apt) {
  return [String(apt.no || '').trim(), String(apt.name || '').trim(), Number(apt.lat).toFixed(6), Number(apt.lng).toFixed(6)].join('|');
}

function findSavedFlyer(no, name, lat, lng) {
  const key = [String(no || '').trim(), String(name || '').trim(), Number(lat).toFixed(6), Number(lng).toFixed(6)].join('|');
  return flyerApartments.find((apt) => flyerMatchKey(apt) === key)
    || flyerApartments.find((apt) => apt.no && String(apt.no) === String(no) && apt.name === name)
    || flyerApartments.find((apt) => apt.name === name && Number(apt.lat).toFixed(6) === Number(lat).toFixed(6) && Number(apt.lng).toFixed(6) === Number(lng).toFixed(6));
}

function normalizeFlyerStatus(unitStatus, distributionDate) {
  const text = `${unitStatus} ${distributionDate}`.trim();
  if (FLYER_STATUSES.includes(unitStatus)) return unitStatus;
  if (/不可|対象外|NG|断り/.test(text)) return '配布不可';
  if (/不在|留守/.test(text)) return '不在';
  if (distributionDate || /済|完了/.test(text)) return '配布済み';
  return '未配布';
}

function normalizeFlyerAssignee(name) {
  const trimmed = String(name || '').trim();
  return flyerAssignees.includes(trimmed) ? trimmed : '';
}

function filteredFlyerApartments() {
  if (displayMode === 'salad') return [];
  const keyword = elements.searchInput.value.trim().toLowerCase();
  const assignee = elements.assigneeFilter.value;
  const status = elements.flyerStatusFilter.value;
  const date = elements.flyerDateFilter.value;
  return flyerApartments.filter((apt) => isLayerVisible(FLYER_LAYER.id) && (!assignee || apt.assignee === assignee) && (!status || apt.status === status) && (!date || apt.distributionDate === date) && (!keyword || [apt.name, apt.address, apt.area, apt.type, apt.schoolDistrict, apt.memo, apt.status, apt.assignee].some((v) => String(v || '').toLowerCase().includes(keyword))));
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
        <div class="flyer-status-buttons flyer-card-status-buttons"><button class="primary" data-set-flyer-status="配布済み" data-flyer-id="${apt.id}">配布済み</button><button data-set-flyer-status="不在" data-flyer-id="${apt.id}">不在</button><button class="danger" data-set-flyer-status="配布不可" data-flyer-id="${apt.id}">配布不可</button></div>
        <label class="photo-button">写真<input type="file" accept="image/*" data-flyer-photo="${apt.id}" hidden></label>
        <button data-focus-flyer="${apt.id}">地図で見る</button>
      </div>
    </article>`).join('') : '<p class="empty">チラシ配布マンションがありません。</p>';
  elements.flyerList.querySelectorAll('[data-set-flyer-status]').forEach((button) => button.addEventListener('click', () => setFlyerStatusFromButton(button.dataset.flyerId, button.dataset.setFlyerStatus)));
  elements.flyerList.querySelectorAll('[data-focus-flyer]').forEach((button) => button.addEventListener('click', () => focusFlyer(button.dataset.focusFlyer)));
  elements.flyerList.querySelectorAll('[data-flyer-status]').forEach((select) => select.addEventListener('change', () => updateFlyer(select.dataset.flyerStatus, { status: select.value })));
  elements.flyerList.querySelectorAll('[data-flyer-assignee]').forEach((select) => select.addEventListener('change', () => updateFlyer(select.dataset.flyerAssignee, { assignee: select.value })));
  elements.flyerList.querySelectorAll('[data-flyer-photo]').forEach((input) => input.addEventListener('change', () => addFlyerPhoto(input.dataset.flyerPhoto, input.files?.[0])));
}

function renderFlyerRoutes() {
  elements.flyerRouteList.innerHTML = flyerRoutes.length ? flyerRoutes.map((route) => `
    <section class="flyer-route-card" style="--route-color:${escapeHtml(route.color)}">
      <h3>${escapeHtml(route.name)}ルート</h3>
      <ol>${route.items.map((apt) => `<li><button type="button" data-focus-flyer="${escapeHtml(apt.id)}">${escapeHtml(apt.name)}</button><small>${escapeHtml(apt.address || '')}</small></li>`).join('')}</ol>
    </section>`).join('') : '';
  elements.flyerRouteList.querySelectorAll('[data-focus-flyer]').forEach((button) => button.addEventListener('click', () => focusFlyer(button.dataset.focusFlyer)));
}

function createTwoPersonRoutes() {
  const targets = filteredFlyerApartments().filter((apt) => apt.status === '未配布' && isValidCoordinate(apt.lat, apt.lng));
  if (!targets.length) {
    flyerRoutes = [];
    renderFlyerRoutes();
    renderMarkers();
    elements.csvStatus.textContent = '未配布かつ緯度経度がある物件がありません。';
    return;
  }
  const activeAssignees = flyerAssignees.filter((name) => String(name || '').trim());
  const routeNames = [activeAssignees[0] || '担当1', activeAssignees[1] || '担当2'];
  const split = splitFlyersForTwoPeople(targets);
  flyerRoutes = split
    .map((items, index) => ({ name: routeNames[index], color: index === 0 ? '#7c3aed' : '#ea580c', items: nearestNeighborRoute(items) }))
    .filter((route) => route.items.length);
  renderFlyerRoutes();
  renderMarkers();
  fitMapToVisibleData();
  elements.csvStatus.textContent = `${targets.length}件の未配布物件を2人分のルートに分けました。`;
}

function splitFlyersForTwoPeople(items) {
  if (items.length <= 1) return [items, []];
  const sorted = [...items].sort((a, b) => a.lng === b.lng ? a.lat - b.lat : a.lng - b.lng);
  const left = sorted.slice(0, Math.ceil(sorted.length / 2));
  const right = sorted.slice(Math.ceil(sorted.length / 2));
  return [left, right];
}

function nearestNeighborRoute(items) {
  const remaining = [...items];
  const route = [];
  let current = remaining.shift();
  while (current) {
    route.push(current);
    if (!remaining.length) break;
    let nextIndex = 0;
    remaining.forEach((apt, index) => {
      if (distanceMeters(current.lat, current.lng, apt.lat, apt.lng) < distanceMeters(current.lat, current.lng, remaining[nextIndex].lat, remaining[nextIndex].lng)) nextIndex = index;
    });
    current = remaining.splice(nextIndex, 1)[0];
  }
  return route;
}

function routeMetaForFlyer(id) {
  for (const route of flyerRoutes) {
    const index = route.items.findIndex((apt) => apt.id === id);
    if (index >= 0) return { color: route.color, label: String(index + 1) };
  }
  return null;
}


function renderFlyerStatusSummary(items) {
  const counts = FLYER_STATUSES.reduce((result, status) => ({ ...result, [status]: 0 }), {});
  items.forEach((apt) => { counts[apt.status] = (counts[apt.status] || 0) + 1; });
  elements.flyerStatusSummary.innerHTML = FLYER_STATUSES.map((status) => `
    <span style="--status-color:${escapeHtml(FLYER_STATUS_COLORS[status])}"><strong>${escapeHtml(status)}</strong>${counts[status] || 0}件</span>`).join('');
}

function updateFlyer(id, patch, options = {}) {
  const normalizedPatch = { ...patch };
  if (Object.prototype.hasOwnProperty.call(normalizedPatch, 'status')) {
    normalizedPatch.status = normalizeFlyerStatus(normalizedPatch.status, normalizedPatch.distributionDate);
  }
  flyerRoutes = flyerRoutes.map((route) => ({ ...route, items: route.items.map((apt) => apt.id === id ? { ...apt, ...normalizedPatch } : apt).filter((apt) => apt.status === '未配布') })).filter((route) => route.items.length);
  flyerApartments = flyerApartments.map((apt) => apt.id === id ? { ...apt, ...normalizedPatch, updatedAt: new Date().toISOString() } : apt);
  saveFlyerApartments(flyerApartments);
  renderFlyerList();
  renderFlyerRoutes();
  renderMarkers();
  const apt = flyerApartments.find((item) => item.id === id);
  const marker = flyerMarkers.find((item) => item.flyerId === id);
  if (apt && marker && !elements.placeDetailPanel.hidden && options.refreshDetail !== false) openFlyerInfo(apt, marker);
  if (options.toastMessage) showToast(options.toastMessage);
}
function setFlyerStatusFromButton(id, status) {
  const apt = flyerApartments.find((item) => item.id === id);
  if (!apt) return;
  const nextPatch = { status };
  if (status === '配布済み' && !apt.distributionDate) nextPatch.distributionDate = todayString();
  updateFlyer(id, nextPatch, { toastMessage: `${status}に変更しました` });
}

function bindFlyerDetailControls(root) {
  root.querySelectorAll('[data-detail-set-flyer-status]').forEach((button) => {
    button.addEventListener('click', () => setFlyerStatusFromButton(button.dataset.flyerId, button.dataset.detailSetFlyerStatus));
  });
  root.querySelectorAll('[data-flyer-detail-input]').forEach((input) => {
    const saveInput = () => {
      const field = input.dataset.flyerDetailInput;
      const card = input.closest('[data-flyer-detail-card]');
      if (!field || !card) return;
      let value = input.value;
      if (field === 'deliveredCount') {
        const numericValue = Math.max(0, Number.parseInt(value || '0', 10));
        value = Number.isNaN(numericValue) ? '' : String(numericValue);
        input.value = value;
      }
      updateFlyer(card.dataset.flyerDetailCard, { [field]: field === 'memo' ? value.trim() : value }, { refreshDetail: false, toastMessage: '保存しました' });
    };
    input.addEventListener('change', saveInput);
    if (input.tagName === 'TEXTAREA') input.addEventListener('blur', saveInput);
  });
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}
async function addFlyerPhoto(id, file) { if (!file) return; const photo = { id: crypto.randomUUID(), name: file.name, dataUrl: await readFileAsDataUrl(file), importedAt: new Date().toISOString() }; flyerApartments = flyerApartments.map((apt) => apt.id === id ? { ...apt, photos: [photo, ...(apt.photos || [])] } : apt); saveFlyerApartments(flyerApartments); renderFlyerList(); renderMarkers(); }
function markerIconForFlyer(apt) {
  const route = routeMetaForFlyer(apt.id);
  if (route) {
    return { url: numberedMarkerSvg(route.color, route.label), scaledSize: new google.maps.Size(34, 42), anchor: new google.maps.Point(17, 42), labelOrigin: new google.maps.Point(17, 16) };
  }
  return { path: google.maps.SymbolPath.CIRCLE, scale: 9, fillColor: FLYER_STATUS_COLORS[apt.status] || FLYER_STATUS_COLORS['未配布'], fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 };
}

function numberedMarkerSvg(color, label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="0 0 34 42"><path d="M17 41S3 27.5 3 16.5C3 8.5 9.3 2 17 2s14 6.5 14 14.5C31 27.5 17 41 17 41Z" fill="${color}" stroke="white" stroke-width="3"/><text x="17" y="21" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" font-weight="700" fill="white">${escapeHtml(label)}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
function openFlyerInfo(apt, marker) {
  openPlaceDetailRef = { type: 'flyer', id: apt.id };
  openPlaceDetail(renderFlyerDetailCard(apt), apt.name);
  if (marker?.getPosition && map) map.panTo(marker.getPosition());
}


function renderFlyerDetailForm(apt, scope) {
  return `
    <form class="flyer-detail-form" data-flyer-detail-form="${escapeHtml(scope)}" data-flyer-id="${escapeHtml(apt.id)}">
      <div class="flyer-detail-header"><strong>${escapeHtml(apt.name)}</strong><button type="button" data-close-flyer-panel>×</button></div>
      <label>物件名<input name="name" value="${escapeHtml(apt.name)}" /></label>
      <label>エリア<input name="area" value="${escapeHtml(apt.area || '')}" /></label>
      <label>戸数<input name="units" value="${escapeHtml(apt.units || '')}" /></label>
      <label>配布状況<select name="status">${FLYER_STATUSES.map((status) => `<option value="${escapeHtml(status)}" ${status === apt.status ? 'selected' : ''}>${escapeHtml(status)}</option>`).join('')}</select></label>
      <label>配布日<input name="distributionDate" type="date" value="${escapeHtml(apt.distributionDate || todayString())}" /></label>
      <label>担当者<select name="assignee">${['', ...flyerAssignees].map((name) => `<option value="${escapeHtml(name)}" ${name === (apt.assignee || '') ? 'selected' : ''}>${escapeHtml(name || '担当者未設定')}</option>`).join('')}</select></label>
      <label>配布枚数<input name="deliveredCount" type="number" min="0" inputmode="numeric" value="${escapeHtml(apt.deliveredCount || apt.units || '')}" /></label>
      <label>メモ<textarea name="memo" rows="3">${escapeHtml(apt.memo || '')}</textarea></label>
      <div class="flyer-status-buttons flyer-detail-status-buttons">${['配布済み', '配布不可', '不在'].map((status) => `<button type="button" data-detail-quick-status="${escapeHtml(status)}" class="${status === '配布済み' ? 'primary' : status === '配布不可' ? 'danger' : ''}">${escapeHtml(status)}</button>`).join('')}</div>
      <button type="submit" class="primary">保存</button>
    </form>`;
}

function bindFlyerDetailForm(root, id, closeOnSave) {
  const form = root.querySelector(`[data-flyer-detail-form][data-flyer-id="${CSS.escape(id)}"]`);
  if (!form) return;
  form.querySelectorAll('[data-detail-quick-status]').forEach((button) => {
    button.addEventListener('click', () => {
      form.elements.status.value = button.dataset.detailQuickStatus;
      if (!form.elements.distributionDate.value) form.elements.distributionDate.value = todayString();
    });
  });
  form.querySelector('[data-close-flyer-panel]')?.addEventListener('click', () => { elements.flyerDetailPanel.hidden = true; infoWindow?.close(); });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    updateFlyer(id, {
      name: data.get('name').trim(),
      area: data.get('area').trim(),
      units: data.get('units').trim(),
      status: data.get('status'),
      distributionDate: data.get('distributionDate') || todayString(),
      assignee: data.get('assignee'),
      deliveredCount: data.get('deliveredCount'),
      memo: data.get('memo').trim(),
    });
    if (closeOnSave) elements.flyerDetailPanel.hidden = true;
  });
}

function exportFlyerCsv() {
  const headers = ['No.', '物件名', 'エリア', '種別', '小学校区', '戸数', '配布状況', '配布日', '担当者', '配布枚数', 'メモ', '緯度', '経度'];
  const rows = filteredFlyerApartments().map((apt) => [apt.no, apt.name, apt.area, apt.type, apt.schoolDistrict, apt.units, apt.status, apt.distributionDate, apt.assignee, apt.deliveredCount, apt.memo, apt.lat, apt.lng]);
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `flyer-results-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  elements.csvStatus.textContent = `${rows.length}件の配布実績CSVを出力しました。`;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function focusFlyer(id) { const apt = flyerApartments.find((item) => item.id === id); if (!apt || !map) return; map.setCenter({ lat: apt.lat, lng: apt.lng }); map.setZoom(16); const marker = flyerMarkers.find((item) => item.flyerId === id); if (marker) openFlyerInfo(apt, marker); }
