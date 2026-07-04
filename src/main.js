const GOOGLE_MAPS_API_KEY = window.SMART_MAP_GOOGLE_MAPS_API_KEY || new URLSearchParams(window.location.search).get('googleMapsApiKey') || '';
const DEFAULT_CENTER = { lat: 35.681236, lng: 139.767125 };
const STORAGE_KEY = 'smart-map-platform:stores';
const LAYERS_STORAGE_KEY = 'smart-map-platform:kml-layers';
const PHOTO_IMPORT_STORAGE_KEY = 'smart-map-platform:photo-imports';
const NEAR_STORE_METERS = 50;
const CANDIDATE_STORE_METERS = 150;
const LAYER_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

let map;
let userMarker;
let infoWindow;
let storeMarkers = [];
let stores = loadStores();
let layers = loadLayers();
let photoImports = loadPhotoImports();
let currentPosition = null;
let googleMapsPromise = null;

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
        <h2>写真インポート</h2>
        <div class="photo-import">
          <label>GPS付きJPEG写真（複数選択可）
            <input id="photoInput" type="file" accept="image/jpeg,image/jpg,.jpg,.jpeg" multiple />
          </label>
          <p class="hint">Exif GPSから位置を読み取り、50m以内は既存店舗へ追加、50〜150mは候補表示、150m以上は新規スポットにします。GPSなし写真は未分類に保存します。</p>
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
  photoInput: document.querySelector('#photoInput'),
  photoStatus: document.querySelector('#photoStatus'),
  photoReview: document.querySelector('#photoReview'),
  kmlInput: document.querySelector('#kmlInput'),
  kmlStatus: document.querySelector('#kmlStatus'),
  layerList: document.querySelector('#layerList'),
  layerCount: document.querySelector('#layerCount'),
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
  renderLayerList();
  renderStoreList();
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
  elements.photoInput.addEventListener('change', importPhotoFiles);
  elements.kmlInput.addEventListener('change', importKmlFiles);
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
      layerId: null,
      layerName: '',
      layerColor: '#16a34a',
      photos: [],
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



async function importPhotoFiles(event) {
  const files = Array.from(event.target.files || []).filter((file) => /jpe?g$/i.test(file.name) || file.type === 'image/jpeg');
  if (!files.length) return;

  elements.photoStatus.textContent = '写真を読み込んでいます...';
  const stats = { attached: 0, candidates: 0, created: 0, unclassified: 0, errors: [] };

  for (const file of files) {
    try {
      const [gps, dataUrl] = await Promise.all([readExifGps(file), readFileAsDataUrl(file)]);
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
        continue;
      }

      const nearest = findNearestStore(gps.lat, gps.lng);
      if (nearest && nearest.distance <= NEAR_STORE_METERS) {
        stores = addPhotoToStore(stores, nearest.store.id, photo);
        stats.attached += 1;
      } else if (nearest && nearest.distance <= CANDIDATE_STORE_METERS) {
        photoImports.candidates = [{ photo, storeId: nearest.store.id, storeName: nearest.store.name, distance: Math.round(nearest.distance) }, ...photoImports.candidates];
        stats.candidates += 1;
      } else {
        stores = [createPhotoSpot(photo), ...stores];
        stats.created += 1;
      }
    } catch (error) {
      stats.errors.push(`${file.name}: ${error.message}`);
    }
  }

  saveStores();
  savePhotoImports();
  renderStoreList();
  renderPhotoReview();
  renderMarkers();
  elements.photoStatus.textContent = [
    `${stats.attached}枚を既存店舗に追加、${stats.candidates}枚を候補、${stats.created}件を新規スポット、${stats.unclassified}枚を未分類にしました。`,
    ...stats.errors,
  ].join(' ');
  event.target.value = '';
}

function createPhotoSpot(photo) {
  return {
    id: crypto.randomUUID(),
    name: photo.name.replace(/\.(jpe?g)$/i, '') || '写真スポット',
    category: '写真スポット',
    description: 'GPS付き写真から作成したスポットです。',
    lat: photo.lat,
    lng: photo.lng,
    createdAt: new Date().toISOString(),
    layerId: null,
    layerName: '',
    layerColor: '#16a34a',
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

function distanceMeters(lat1, lng1, lat2, lng2) {
  const earthRadius = 6371000;
  const toRadians = (value) => value * Math.PI / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
  saveStores();
  savePhotoImports();
  renderStoreList();
  renderPhotoReview();
  renderMarkers();
}

async function readExifGps(file) {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  if (view.getUint16(0) !== 0xffd8) throw new Error('JPEG形式ではありません。');

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset);
    offset += 2;
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
  const littleEndian = getAscii(view, tiffOffset, 2) === 'II';
  const firstIfdOffset = getUint32(view, tiffOffset + 4, littleEndian);
  const gpsIfdPointer = findIfdValue(view, tiffOffset + firstIfdOffset, 0x8825, littleEndian, tiffOffset);
  if (!gpsIfdPointer) return null;

  const gpsIfd = tiffOffset + gpsIfdPointer;
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
  const count = getUint16(view, ifdOffset, littleEndian);
  for (let i = 0; i < count; i += 1) {
    const entry = ifdOffset + 2 + i * 12;
    if (getUint16(view, entry, littleEndian) !== tag) continue;
    const type = getUint16(view, entry + 2, littleEndian);
    const values = getUint32(view, entry + 4, littleEndian);
    const valueOffset = values * typeByteSize(type) <= 4 ? entry + 8 : tiffOffset + getUint32(view, entry + 8, littleEndian);
    if (type === 2) return getAscii(view, valueOffset, values).replace(/\0/g, '');
    if (type === 5) return Array.from({ length: values }, (_, index) => {
      const rationalOffset = valueOffset + index * 8;
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

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('写真の読み込みに失敗しました。'));
    reader.readAsDataURL(file);
  });
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
    saveLayers();
    saveStores();
    renderLayerList();
    renderStoreList();
    renderMarkers();
    focusStore(importedStores[0].id);
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
}

function markerIconForStore(store) {
  const color = store.layerColor || getLayerById(store.layerId)?.color || '#16a34a';
  return { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: color, fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 };
}

function openStoreInfo(store, marker) {
  const layerLabel = store.layerName ? `<br>レイヤー: ${escapeHtml(store.layerName)}` : '';
  const photoLabel = store.photos?.length ? `<br>写真: ${store.photos.length}枚` : '';
  infoWindow.setContent(`<strong>${escapeHtml(store.name)}</strong><br>${escapeHtml(store.category)}${layerLabel}${photoLabel}<br>${escapeHtml(store.description || '説明なし')}`);
  infoWindow.open({ anchor: marker, map });
}

function renderLayerList() {
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
  saveLayers();
  renderStoreList();
  renderMarkers();
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
          <p class="category">${escapeHtml(store.category)}</p>
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

function renderPhotoThumbnails(photos = []) {
  return photos.length
    ? `<div class="photo-thumbnails">${photos.slice(0, 4).map((photo) => `<img src="${escapeHtml(photo.dataUrl)}" alt="${escapeHtml(photo.name)}" title="${escapeHtml(photo.name)}" />`).join('')}${photos.length > 4 ? `<span>+${photos.length - 4}</span>` : ''}</div>`
    : '';
}

function deleteStore(id) {
  stores = stores.filter((store) => store.id !== id);
  layers = layers.filter((layer) => countStoresInLayer(layer.id) > 0);
  saveStores();
  saveLayers();
  renderLayerList();
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
  const visibleLayerIds = new Set(layers.filter((layer) => layer.visible).map((layer) => layer.id));
  const layerFilteredStores = stores.filter((store) => !store.layerId || visibleLayerIds.has(store.layerId));
  if (!keyword) return layerFilteredStores;
  return layerFilteredStores.filter((store) => [store.name, store.category, store.description, store.layerName].some((value) => String(value || '').toLowerCase().includes(keyword)));
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

function loadLayers() {
  try {
    return JSON.parse(localStorage.getItem(LAYERS_STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function loadPhotoImports() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PHOTO_IMPORT_STORAGE_KEY)) || {};
    return { candidates: parsed.candidates || [], unclassified: parsed.unclassified || [] };
  } catch {
    return { candidates: [], unclassified: [] };
  }
}

function saveStores() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stores));
}

function saveLayers() {
  localStorage.setItem(LAYERS_STORAGE_KEY, JSON.stringify(layers));
}

function savePhotoImports() {
  localStorage.setItem(PHOTO_IMPORT_STORAGE_KEY, JSON.stringify(photoImports));
}

function seedStoresIfEmpty() {
  if (stores.length) return;
  stores = [
    { id: 'sample-1', name: 'Green Bowl Marunouchi', category: 'サラダ', description: '丸の内エリアのサンプル店舗です。', lat: 35.681236, lng: 139.767125, createdAt: new Date().toISOString(), photos: [] },
    { id: 'sample-2', name: 'Fresh Deli Ginza', category: 'デリ', description: '検索と一覧表示を試すためのサンプルです。', lat: 35.671989, lng: 139.763965, createdAt: new Date().toISOString(), photos: [] },
  ];
  saveStores();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}
