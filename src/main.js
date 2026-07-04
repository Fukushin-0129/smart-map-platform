const GOOGLE_MAPS_API_KEY = window.SMART_MAP_GOOGLE_MAPS_API_KEY || new URLSearchParams(window.location.search).get('googleMapsApiKey') || '';
const DEFAULT_CENTER = { lat: 35.681236, lng: 139.767125 };
const STORAGE_KEY = 'smart-map-platform:stores';
const LAYERS_STORAGE_KEY = 'smart-map-platform:kml-layers';
const PHOTOS_STORAGE_KEY = 'smart-map-platform:photos';
const LAYER_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

let map;
let userMarker;
let infoWindow;
let storeMarkers = [];
let stores = loadStores();
let layers = loadLayers();
let photos = loadPhotos();
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
        <h2>写真インポート</h2>
        <div class="photo-import">
          <label>GPS付きJPEG写真（複数選択可）
            <input id="photoInput" type="file" accept="image/jpeg,.jpg,.jpeg" multiple />
          </label>
          <p class="hint">ExifのGPS位置情報を読み取り、近い店舗へ自動追加します。50m〜150mの写真は候補として確認できます。</p>
          <p id="photoStatus" class="import-status" aria-live="polite"></p>
        </div>
        <div id="candidateList" class="candidate-list"></div>
        <div id="unclassifiedList" class="unclassified-list"></div>
      </section>

      <section>
        <h2>店舗検索</h2>
        <input id="searchInput" class="search" placeholder="店舗名・カテゴリ・説明・レイヤー名で検索" />
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
  kmlInput: document.querySelector('#kmlInput'),
  kmlStatus: document.querySelector('#kmlStatus'),
  photoInput: document.querySelector('#photoInput'),
  photoStatus: document.querySelector('#photoStatus'),
  candidateList: document.querySelector('#candidateList'),
  unclassifiedList: document.querySelector('#unclassifiedList'),
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
  normalizeStoredData();
  seedStoresIfEmpty();
  renderLayerList();
  renderPhotoReviewLists();
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
  elements.kmlInput.addEventListener('change', importKmlFiles);
  elements.photoInput.addEventListener('change', importPhotoFiles);
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
      photoIds: [],
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
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  elements.photoStatus.textContent = '写真を読み込んでいます...';

  const results = { attached: 0, candidates: 0, created: 0, unclassified: 0, errors: [] };

  for (const file of files) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const dataUrl = await readFileAsDataUrl(file);
      const location = extractExifGps(arrayBuffer);
      const photo = createPhoto(file, dataUrl, location);

      if (!location) {
        photo.status = 'unclassified';
        photos = [photo, ...photos];
        results.unclassified += 1;
        continue;
      }

      const nearest = findNearestStore(location.lat, location.lng);
      if (nearest && nearest.distance <= 50) {
        photo.status = 'attached';
        photo.storeId = nearest.store.id;
        photo.storeName = nearest.store.name;
        photos = [photo, ...photos];
        attachPhotoToStore(nearest.store.id, photo.id);
        results.attached += 1;
      } else if (nearest && nearest.distance <= 150) {
        photo.status = 'candidate';
        photo.candidateStoreId = nearest.store.id;
        photo.candidateStoreName = nearest.store.name;
        photo.candidateDistance = nearest.distance;
        photos = [photo, ...photos];
        results.candidates += 1;
      } else {
        const newStore = createSpotFromPhoto(photo);
        photo.status = 'attached';
        photo.storeId = newStore.id;
        photo.storeName = newStore.name;
        photo.createdSpot = true;
        photos = [photo, ...photos];
        stores = [newStore, ...stores];
        results.created += 1;
      }
    } catch (error) {
      results.errors.push(`${file.name}: ${error.message}`);
    }
  }

  savePhotos();
  saveStores();
  renderPhotoReviewLists();
  renderStoreList();
  renderMarkers();

  elements.photoStatus.textContent = [
    `${files.length}枚を処理しました。`,
    `50m以内: ${results.attached}枚`,
    `候補あり: ${results.candidates}枚`,
    `新規スポット: ${results.created}件`,
    `GPSなし: ${results.unclassified}枚`,
    ...results.errors,
  ].join(' / ');
  event.target.value = '';
}

function createPhoto(file, dataUrl, location) {
  return {
    id: crypto.randomUUID(),
    name: file.name,
    dataUrl,
    lat: location?.lat ?? null,
    lng: location?.lng ?? null,
    status: 'pending',
    uploadedAt: new Date().toISOString(),
  };
}

function createSpotFromPhoto(photo) {
  return {
    id: crypto.randomUUID(),
    name: stripImageExtension(photo.name) || '写真スポット',
    category: '写真スポット',
    description: 'Exif GPS情報から自動作成したスポットです。',
    lat: photo.lat,
    lng: photo.lng,
    createdAt: new Date().toISOString(),
    layerId: null,
    layerName: '',
    layerColor: '#16a34a',
    photoIds: [photo.id],
  };
}

function attachPhotoToStore(storeId, photoId) {
  stores = stores.map((store) => {
    if (store.id !== storeId) return store;
    const photoIds = Array.isArray(store.photoIds) ? store.photoIds : [];
    return { ...store, photoIds: [...new Set([photoId, ...photoIds])] };
  });
}

function confirmCandidatePhoto(photoId) {
  const photo = photos.find((item) => item.id === photoId);
  if (!photo?.candidateStoreId) return;
  attachPhotoToStore(photo.candidateStoreId, photo.id);
  photos = photos.map((item) => item.id === photoId ? {
    ...item,
    status: 'attached',
    storeId: item.candidateStoreId,
    storeName: item.candidateStoreName,
    candidateStoreId: null,
    candidateStoreName: '',
    candidateDistance: null,
  } : item);
  savePhotos();
  saveStores();
  renderPhotoReviewLists();
  renderStoreList();
}

function createSpotFromCandidate(photoId) {
  const photo = photos.find((item) => item.id === photoId);
  if (!photo || !isValidCoordinate(photo.lat, photo.lng)) return;
  const newStore = createSpotFromPhoto(photo);
  stores = [newStore, ...stores];
  photos = photos.map((item) => item.id === photoId ? {
    ...item,
    status: 'attached',
    storeId: newStore.id,
    storeName: newStore.name,
    candidateStoreId: null,
    candidateStoreName: '',
    candidateDistance: null,
    createdSpot: true,
  } : item);
  savePhotos();
  saveStores();
  renderPhotoReviewLists();
  renderStoreList();
  renderMarkers();
  focusStore(newStore.id);
}

function renderPhotoReviewLists() {
  renderCandidatePhotos();
  renderUnclassifiedPhotos();
}

function renderCandidatePhotos() {
  const candidates = photos.filter((photo) => photo.status === 'candidate');
  elements.candidateList.innerHTML = candidates.length
    ? `<h3>候補あり写真</h3>${candidates.map((photo) => `
      <article class="photo-review-card">
        <img src="${photo.dataUrl}" alt="${escapeHtml(photo.name)}" />
        <div>
          <strong>${escapeHtml(photo.name)}</strong>
          <p>${escapeHtml(photo.candidateStoreName)} まで約${Math.round(photo.candidateDistance)}mです。</p>
          <div class="button-row compact">
            <button data-confirm-photo="${photo.id}">この店舗に追加</button>
            <button data-create-spot="${photo.id}">新規スポット化</button>
          </div>
        </div>
      </article>`).join('')}`
    : '';

  elements.candidateList.querySelectorAll('[data-confirm-photo]').forEach((button) => {
    button.addEventListener('click', () => confirmCandidatePhoto(button.dataset.confirmPhoto));
  });
  elements.candidateList.querySelectorAll('[data-create-spot]').forEach((button) => {
    button.addEventListener('click', () => createSpotFromCandidate(button.dataset.createSpot));
  });
}

function renderUnclassifiedPhotos() {
  const unclassified = photos.filter((photo) => photo.status === 'unclassified');
  elements.unclassifiedList.innerHTML = unclassified.length
    ? `<h3>未分類写真</h3><p class="hint">Exif GPS情報がないため、店舗には自動追加していません。</p><div class="photo-grid">${unclassified.map((photo) => `
      <figure class="photo-thumb"><img src="${photo.dataUrl}" alt="${escapeHtml(photo.name)}" /><figcaption>${escapeHtml(photo.name)}</figcaption></figure>`).join('')}</div>`
    : '';
}

function photosForStore(store) {
  const photoIds = new Set(Array.isArray(store.photoIds) ? store.photoIds : []);
  return photos.filter((photo) => photo.storeId === store.id || photoIds.has(photo.id));
}

function renderStorePhotos(store) {
  const storePhotos = photosForStore(store).slice(0, 4);
  if (!storePhotos.length) return '';
  return `<div class="store-photos">${storePhotos.map((photo) => `<img src="${photo.dataUrl}" alt="${escapeHtml(photo.name)}" title="${escapeHtml(photo.name)}" />`).join('')}</div>`;
}

function findNearestStore(lat, lng) {
  return stores.reduce((nearest, store) => {
    if (!isValidCoordinate(store.lat, store.lng)) return nearest;
    const distance = calculateDistanceMeters(lat, lng, store.lat, store.lng);
    if (!nearest || distance < nearest.distance) return { store, distance };
    return nearest;
  }, null);
}

function calculateDistanceMeters(lat1, lng1, lat2, lng2) {
  const earthRadius = 6371000;
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('写真データの読み込みに失敗しました。'));
    reader.readAsDataURL(file);
  });
}

function extractExifGps(arrayBuffer) {
  try {
    const view = new DataView(arrayBuffer);
    if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) return null;

    let offset = 2;
    while (offset + 4 < view.byteLength) {
      const marker = view.getUint16(offset, false);
      offset += 2;
      const segmentLength = view.getUint16(offset, false);
      if (segmentLength < 2 || offset + segmentLength > view.byteLength) return null;
      if (marker === 0xffe1 && getAscii(view, offset + 2, 4) === 'Exif') {
        return parseExifGps(view, offset + 8);
      }
      offset += segmentLength;
    }
    return null;
  } catch {
    return null;
  }
}

function parseExifGps(view, tiffOffset) {
  const littleEndian = getAscii(view, tiffOffset, 2) === 'II';
  const firstIfdOffset = readUint32(view, tiffOffset + 4, littleEndian);
  const gpsIfdOffset = findIfdValue(view, tiffOffset + firstIfdOffset, 0x8825, tiffOffset, littleEndian);
  if (!gpsIfdOffset) return null;

  const gpsIfd = tiffOffset + gpsIfdOffset;
  const latRef = readAsciiValue(view, gpsIfd, 0x0001, tiffOffset, littleEndian);
  const latValues = readRationalArrayValue(view, gpsIfd, 0x0002, tiffOffset, littleEndian);
  const lngRef = readAsciiValue(view, gpsIfd, 0x0003, tiffOffset, littleEndian);
  const lngValues = readRationalArrayValue(view, gpsIfd, 0x0004, tiffOffset, littleEndian);
  if (!latRef || !lngRef || latValues.length < 3 || lngValues.length < 3) return null;

  const lat = dmsToDecimal(latValues, latRef);
  const lng = dmsToDecimal(lngValues, lngRef);
  return isValidCoordinate(lat, lng) ? { lat, lng } : null;
}

function findIfdValue(view, ifdOffset, tag, tiffOffset, littleEndian) {
  const entries = readUint16(view, ifdOffset, littleEndian);
  for (let index = 0; index < entries; index += 1) {
    const entryOffset = ifdOffset + 2 + index * 12;
    if (readUint16(view, entryOffset, littleEndian) === tag) {
      return readValueOffset(view, entryOffset, tiffOffset, littleEndian);
    }
  }
  return 0;
}

function readAsciiValue(view, ifdOffset, tag, tiffOffset, littleEndian) {
  const entryOffset = findIfdEntry(view, ifdOffset, tag, littleEndian);
  if (!entryOffset) return '';
  const count = readUint32(view, entryOffset + 4, littleEndian);
  const valueOffset = count <= 4 ? entryOffset + 8 : tiffOffset + readUint32(view, entryOffset + 8, littleEndian);
  return getAscii(view, valueOffset, count).replace(/\0/g, '').trim();
}

function readRationalArrayValue(view, ifdOffset, tag, tiffOffset, littleEndian) {
  const entryOffset = findIfdEntry(view, ifdOffset, tag, littleEndian);
  if (!entryOffset) return [];
  const count = readUint32(view, entryOffset + 4, littleEndian);
  const valueOffset = tiffOffset + readUint32(view, entryOffset + 8, littleEndian);
  return Array.from({ length: count }, (_, index) => readRational(view, valueOffset + index * 8, littleEndian));
}

function findIfdEntry(view, ifdOffset, tag, littleEndian) {
  const entries = readUint16(view, ifdOffset, littleEndian);
  for (let index = 0; index < entries; index += 1) {
    const entryOffset = ifdOffset + 2 + index * 12;
    if (readUint16(view, entryOffset, littleEndian) === tag) return entryOffset;
  }
  return 0;
}

function readValueOffset(view, entryOffset, tiffOffset, littleEndian) {
  const type = readUint16(view, entryOffset + 2, littleEndian);
  const count = readUint32(view, entryOffset + 4, littleEndian);
  if (type === 4 && count === 1) return readUint32(view, entryOffset + 8, littleEndian);
  return readUint32(view, entryOffset + 8, littleEndian) - tiffOffset;
}

function readRational(view, offset, littleEndian) {
  const numerator = readUint32(view, offset, littleEndian);
  const denominator = readUint32(view, offset + 4, littleEndian);
  return denominator ? numerator / denominator : 0;
}

function readUint16(view, offset, littleEndian) {
  return view.getUint16(offset, littleEndian);
}

function readUint32(view, offset, littleEndian) {
  return view.getUint32(offset, littleEndian);
}

function getAscii(view, offset, length) {
  return Array.from({ length }, (_, index) => String.fromCharCode(view.getUint8(offset + index))).join('');
}

function dmsToDecimal(values, ref) {
  const decimal = values[0] + values[1] / 60 + values[2] / 3600;
  return ['S', 'W'].includes(ref.toUpperCase()) ? -decimal : decimal;
}

function stripImageExtension(fileName) {
  return fileName.replace(/\.(jpe?g)$/i, '');
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
      photoIds: [],
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
  infoWindow.setContent(`<strong>${escapeHtml(store.name)}</strong><br>${escapeHtml(store.category)}${layerLabel}<br>${escapeHtml(store.description || '説明なし')}`);
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
          ${renderStorePhotos(store)}
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
  photos = photos.map((photo) => photo.storeId === id ? { ...photo, status: 'unclassified', storeId: null, storeName: '' } : photo);
  stores = stores.filter((store) => store.id !== id);
  layers = layers.filter((layer) => countStoresInLayer(layer.id) > 0);
  saveStores();
  saveLayers();
  savePhotos();
  renderLayerList();
  renderPhotoReviewLists();
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

function normalizeStoredData() {
  const normalizedStores = stores.map((store) => ({
    ...store,
    layerId: store.layerId ?? null,
    layerName: store.layerName || '',
    layerColor: store.layerColor || '#16a34a',
    photoIds: Array.isArray(store.photoIds) ? store.photoIds : [],
  }));
  const validStoreIds = new Set(normalizedStores.map((store) => store.id));
  const normalizedPhotos = photos.map((photo) => {
    const attachedStoreMissing = photo.storeId && !validStoreIds.has(photo.storeId);
    const candidateStoreMissing = photo.candidateStoreId && !validStoreIds.has(photo.candidateStoreId);
    if (!attachedStoreMissing && !candidateStoreMissing) return photo;
    return {
      ...photo,
      status: 'unclassified',
      storeId: null,
      storeName: '',
      candidateStoreId: null,
      candidateStoreName: '',
      candidateDistance: null,
    };
  });

  if (JSON.stringify(normalizedStores) !== JSON.stringify(stores)) {
    stores = normalizedStores;
    saveStores();
  }
  if (JSON.stringify(normalizedPhotos) !== JSON.stringify(photos)) {
    photos = normalizedPhotos;
    savePhotos();
  }
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

function loadPhotos() {
  try {
    return JSON.parse(localStorage.getItem(PHOTOS_STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveStores() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stores));
}

function saveLayers() {
  localStorage.setItem(LAYERS_STORAGE_KEY, JSON.stringify(layers));
}

function savePhotos() {
  localStorage.setItem(PHOTOS_STORAGE_KEY, JSON.stringify(photos));
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
