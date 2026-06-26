const GOOGLE_MAPS_API_KEY = window.SMART_MAP_GOOGLE_MAPS_API_KEY || new URLSearchParams(window.location.search).get('googleMapsApiKey') || '';
const DEFAULT_CENTER = { lat: 35.681236, lng: 139.767125 };
const STORAGE_KEY = 'smart-map-platform:stores';

let map;
let userMarker;
let infoWindow;
let storeMarkers = [];
let stores = loadStores();
let currentPosition = null;
let googleMapsPromise = null;

const app = document.querySelector('#app');

app.innerHTML = `
  <header class="hero">
    <div>
      <p class="eyebrow">Smart Map Platform</p>
      <h1>サラダマップ風 店舗登録・検索アプリ</h1>
      <p class="lead">Google Maps JavaScript APIで現在地取得、店舗登録、一覧表示、検索を行えます。</p>
      <p class="api-help">APIキーはプロジェクト直下の <code>config.js</code> に設定します。</p>
    </div>
    <button id="locateButton" class="primary">現在地を取得</button>
  </header>

  <main class="layout">
    <section class="panel map-panel" aria-label="地図">
      <div id="map" class="map">
        <div id="mapSetup" class="map-setup" hidden>
          <h2>Google Maps APIキーを設定してください</h2>
          <p><code>npm run init:config</code> を実行し、作成された <code>config.js</code> に取得済みのAPIキーを貼り付けてから再読み込みしてください。</p>
        </div>
      </div>
      <p id="mapStatus" class="status">Google Mapsを読み込み中です。</p>
    </section>

    <aside class="panel controls" aria-label="店舗管理">
      <section>
        <h2>店舗登録</h2>
        <form id="storeForm" class="form">
          <label>店舗名<input id="name" name="name" required placeholder="例: Green Salad Tokyo" /></label>
          <label>カテゴリ<input id="category" name="category" placeholder="例: サラダ / カフェ / テイクアウト" /></label>
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
    </aside>
  </main>
`;

const elements = {
  mapStatus: document.querySelector('#mapStatus'),
  mapSetup: document.querySelector('#mapSetup'),
  locateButton: document.querySelector('#locateButton'),
  storeForm: document.querySelector('#storeForm'),
  useCenterButton: document.querySelector('#useCenterButton'),
  searchInput: document.querySelector('#searchInput'),
  storeList: document.querySelector('#storeList'),
  count: document.querySelector('#count'),
  name: document.querySelector('#name'),
  category: document.querySelector('#category'),
  description: document.querySelector('#description'),
  lat: document.querySelector('#lat'),
  lng: document.querySelector('#lng'),
};

initialize();

async function initialize() {
  seedStoresIfEmpty();
  renderStoreList();
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
    map.addListener('click', (event) => fillCoordinates(event.latLng.lat(), event.latLng.lng()));
    renderMarkers();
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
  elements.storeForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(elements.storeForm);
    const store = {
      id: crypto.randomUUID(),
      name: formData.get('name').trim(),
      category: formData.get('category').trim() || '未分類',
      description: formData.get('description').trim(),
      lat: Number(formData.get('lat')),
      lng: Number(formData.get('lng')),
      createdAt: new Date().toISOString(),
    };

    if (!isValidCoordinate(store.lat, store.lng)) {
      alert('緯度は-90〜90、経度は-180〜180の範囲で入力してください。');
      return;
    }

    stores = [store, ...stores];
    saveStores();
    elements.storeForm.reset();
    renderStoreList();
    renderMarkers();
    focusStore(store.id);
  });
}

function loadGoogleMaps() {
  if (!GOOGLE_MAPS_API_KEY) {
    return Promise.reject(new Error('config.jsにGoogle Maps JavaScript APIキーを設定してください。'));
  }
  if (window.google?.maps) return Promise.resolve();
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    window.initSmartMap = resolve;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&callback=initSmartMap&v=weekly`;
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
  storeMarkers = filteredStores().map((store) => {
    const marker = new google.maps.Marker({ position: { lat: store.lat, lng: store.lng }, map, title: store.name });
    marker.storeId = store.id;
    marker.addListener('click', () => openStoreInfo(store, marker));
    return marker;
  });
}

function openStoreInfo(store, marker) {
  infoWindow.setContent(`<strong>${escapeHtml(store.name)}</strong><br>${escapeHtml(store.category)}<br>${escapeHtml(store.description || '説明なし')}`);
  infoWindow.open({ anchor: marker, map });
}

function renderStoreList() {
  const visibleStores = filteredStores();
  elements.count.textContent = `${visibleStores.length}件`;
  elements.storeList.innerHTML = visibleStores.length
    ? visibleStores.map((store) => `
      <article class="store-card">
        <div>
          <h3>${escapeHtml(store.name)}</h3>
          <p class="category">${escapeHtml(store.category)}</p>
          <p>${escapeHtml(store.description || '説明なし')}</p>
          <p class="coords">${store.lat.toFixed(6)}, ${store.lng.toFixed(6)}</p>
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

function deleteStore(id) {
  stores = stores.filter((store) => store.id !== id);
  saveStores();
  infoWindow?.close();
  renderStoreList();
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
  if (!keyword) return stores;
  return stores.filter((store) => [store.name, store.category, store.description].some((value) => value.toLowerCase().includes(keyword)));
}

function fillCoordinates(lat, lng) {
  elements.lat.value = lat.toFixed(6);
  elements.lng.value = lng.toFixed(6);
}

function isValidCoordinate(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function loadStores() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveStores() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stores));
}

function seedStoresIfEmpty() {
  if (stores.length) return;
  stores = [
    { id: 'sample-1', name: 'Green Bowl Marunouchi', category: 'サラダ', description: '丸の内エリアのサンプル店舗です。', lat: 35.681236, lng: 139.767125, createdAt: new Date().toISOString() },
    { id: 'sample-2', name: 'Fresh Deli Ginza', category: 'デリ', description: '検索と一覧表示を試すためのサンプルです。', lat: 35.671989, lng: 139.763965, createdAt: new Date().toISOString() },
  ];
  saveStores();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}
