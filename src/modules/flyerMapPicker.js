const PANEL_ID = 'flyerMapCandidatePanel';
const STYLE_ID = 'flyerMapCandidateStyles';
let suppressNextMapSearch = false;

const RESIDENTIAL_WORDS = [
  'マンション', 'アパート', 'ハイツ', 'コーポ', 'メゾン', 'レジデンス',
  'レジデンシャル', 'パレス', 'ヴィラ', 'ビラ', 'シャトー', 'グラン',
  'シティ', 'ガーデン', 'ヒルズ', 'タワー', '団地', '住宅', '荘', '寮',
];

const EXCLUDED_WORDS = [
  '住宅ローン', '融資', '銀行', '農協', '営業部', '営業所', '支店', '店舗',
  '不動産', '管理会社', '管理センター', '工務店', '建設', '介護', '病院',
  'クリニック', '学校', '幼稚園', '保育園', '寺', '神社', '公園', '駐車場',
  'レストラン', 'カフェ', 'コンビニ', 'スーパー', 'ホテル', '会社', '株式会社',
];

export function initializeFlyerMapPicker() {
  injectStyles();
  ensureLauncherButton();

  window.addEventListener('smart-map-ready', (event) => attachToMap(event.detail?.map));
  const timer = window.setInterval(() => {
    ensureLauncherButton();
    if (window.__SMART_MAP_INSTANCE__) {
      attachToMap(window.__SMART_MAP_INSTANCE__);
      window.clearInterval(timer);
    }
  }, 250);
  window.setTimeout(() => window.clearInterval(timer), 20000);
}

function ensureLauncherButton() {
  const menu = document.querySelector('#addFabMenu');
  if (!menu || menu.querySelector('[data-open-flyer-nearby-picker]')) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.openFlyerNearbyPicker = '';
  button.textContent = '地図をたどってマンションを登録';
  button.addEventListener('click', startMapPicking);
  menu.prepend(button);
}

function startMapPicking() {
  const existingMapButton = document.querySelector('[data-open-flyer-map-registration]');
  existingMapButton?.click();
  document.querySelector('#addFabMenu')?.setAttribute('hidden', '');
  showInstruction();
}

function attachToMap(map) {
  if (!map || map.__flyerCandidatePickerAttached) return;
  map.__flyerCandidatePickerAttached = true;

  map.addListener('click', (event) => {
    if (suppressNextMapSearch) {
      suppressNextMapSearch = false;
      return;
    }

    const registrationPanel = document.querySelector('#flyerRegistrationPanel');
    if (!registrationPanel || registrationPanel.hidden) return;
    if (!registrationPanel.querySelector('.flyer-registration-map:not([hidden])')) return;

    if (event.placeId) {
      event.stop?.();
      loadPlaceById(map, event.placeId, event.latLng);
      return;
    }
    searchNearbyBuildings(map, event.latLng);
  });
}

function showInstruction() {
  renderPanel(`
    <div class="flyer-map-candidate-header">
      <div><strong>地図からマンションを探す</strong><small>通った道をたどり、建物名または建物付近をクリックしてください。</small></div>
      <button type="button" data-close-candidates aria-label="閉じる">×</button>
    </div>
    <p class="flyer-map-candidate-message">建物名を直接クリックできない場合も、付近をクリックすると周辺候補を表示します。</p>
  `);
}

function loadPlaceById(map, placeId, fallbackLatLng) {
  const service = new google.maps.places.PlacesService(map);
  renderLoading('建物情報を取得しています…');
  service.getDetails({
    placeId,
    fields: ['name', 'formatted_address', 'geometry', 'place_id', 'types'],
    language: 'ja',
  }, (place, status) => {
    if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
      searchNearbyBuildings(map, fallbackLatLng);
      return;
    }

    const normalized = normalizePlace(place);
    if (isExcludedCandidate(normalized)) {
      searchNearbyBuildings(map, fallbackLatLng);
      return;
    }
    renderCandidates(map, [normalized], fallbackLatLng);
  });
}

function searchNearbyBuildings(map, latLng) {
  if (!latLng) return;
  renderLoading('この付近のマンション・建物を探しています…');

  const geocoder = new google.maps.Geocoder();
  const location = { lat: latLng.lat(), lng: latLng.lng() };
  geocoder.geocode({ location, language: 'ja', region: 'JP' }, (geocodeResults) => {
    const areaWords = extractAreaWords(geocodeResults || []);
    runResidentialSearches(map, location, latLng, areaWords);
  });
}

function runResidentialSearches(map, location, clickedLatLng, areaWords) {
  const service = new google.maps.places.PlacesService(map);
  const localPrefix = areaWords.join(' ');
  const queries = [
    localPrefix && `${localPrefix} マンション`,
    localPrefix && `${localPrefix} アパート`,
    localPrefix && `${localPrefix} ハイツ`,
    localPrefix && `${localPrefix} コーポ`,
    localPrefix && `${localPrefix} レジデンス`,
    'マンション',
    'アパート',
  ].filter(Boolean);

  let remaining = queries.length;
  const collected = [];

  queries.forEach((query) => {
    service.textSearch({ query, location, radius: 350, language: 'ja', region: 'JP' }, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        collected.push(...results);
      }
      remaining -= 1;
      if (remaining === 0) {
        const candidates = uniqueNearbyPlaces(collected, location).slice(0, 8);
        renderCandidates(map, candidates, clickedLatLng);
      }
    });
  });
}

function extractAreaWords(results) {
  const components = results[0]?.address_components || [];
  const wantedTypes = new Set(['locality', 'sublocality_level_1', 'sublocality_level_2', 'sublocality_level_3']);
  const words = components
    .filter((component) => component.types?.some((type) => wantedTypes.has(type)))
    .map((component) => component.long_name)
    .filter(Boolean);
  return [...new Set(words)].slice(-3);
}

function uniqueNearbyPlaces(results, origin) {
  const seen = new Set();
  return results
    .filter((place) => place.geometry?.location && place.name)
    .map(normalizePlace)
    .filter((place) => {
      if (isExcludedCandidate(place)) return false;
      const key = place.placeId || `${place.name}:${place.address}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return distanceMeters(origin, place) <= 450;
    })
    .sort((a, b) => candidateScore(b, origin) - candidateScore(a, origin));
}

function isExcludedCandidate(place) {
  const text = `${place.name} ${place.address}`;
  return EXCLUDED_WORDS.some((word) => text.includes(word));
}

function candidateScore(place, origin) {
  const text = `${place.name} ${place.address}`;
  const residentialHits = RESIDENTIAL_WORDS.filter((word) => text.includes(word)).length;
  const distance = distanceMeters(origin, place);
  const typeBonus = (place.types || []).some((type) => ['premise', 'subpremise', 'lodging'].includes(type)) ? 30 : 0;
  return residentialHits * 100 + typeBonus - distance / 5;
}

function normalizePlace(place) {
  const location = place.geometry?.location;
  return {
    name: place.name || '',
    address: place.formatted_address || place.vicinity || '',
    placeId: place.place_id || '',
    types: place.types || [],
    lat: typeof location?.lat === 'function' ? location.lat() : Number(location?.lat),
    lng: typeof location?.lng === 'function' ? location.lng() : Number(location?.lng),
  };
}

function distanceMeters(a, b) {
  const aLat = typeof a.lat === 'function' ? a.lat() : Number(a.lat);
  const aLng = typeof a.lng === 'function' ? a.lng() : Number(a.lng);
  const bLat = Number(b.lat);
  const bLng = Number(b.lng);
  const rad = (value) => value * Math.PI / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function renderCandidates(map, candidates, clickedLatLng) {
  if (!candidates.length) {
    renderPanel(`
      <div class="flyer-map-candidate-header"><div><strong>マンション候補が見つかりませんでした</strong><small>Googleに建物名が登録されていない可能性があります。クリック地点をそのまま登録できます。</small></div><button type="button" data-close-candidates>×</button></div>
      <button type="button" class="flyer-map-use-clicked" data-use-clicked-location>この位置を名前なしで登録画面へ</button>
    `);
    bindClickedLocation(map, clickedLatLng);
    return;
  }

  renderPanel(`
    <div class="flyer-map-candidate-header">
      <div><strong>この付近のマンション候補</strong><small>近い順・集合住宅らしい名称を優先しています。</small></div>
      <button type="button" data-close-candidates>×</button>
    </div>
    <div class="flyer-map-candidate-list">
      ${candidates.map((place, index) => `
        <button type="button" class="flyer-map-candidate" data-candidate-index="${index}">
          <strong>${escapeHtml(place.name)}</strong>
          <span>${escapeHtml(place.address || '住所情報なし')}</span>
        </button>`).join('')}
    </div>
    <button type="button" class="flyer-map-use-clicked" data-use-clicked-location>候補にないためクリック位置を使う</button>
  `);

  const panel = document.querySelector(`#${PANEL_ID}`);
  panel.querySelectorAll('[data-candidate-index]').forEach((button) => {
    button.addEventListener('click', () => selectCandidate(map, candidates[Number(button.dataset.candidateIndex)]));
  });
  bindClickedLocation(map, clickedLatLng);
}

function selectCandidate(map, place) {
  const latLng = new google.maps.LatLng(place.lat, place.lng);
  suppressNextMapSearch = true;
  google.maps.event.trigger(map, 'click', { latLng });
  map.panTo(latLng);
  map.setZoom(Math.max(map.getZoom() || 17, 18));

  window.setTimeout(() => {
    const form = document.querySelector('#flyerRegistrationForm');
    if (!form) return;
    const name = form.elements.namedItem('name');
    const address = form.elements.namedItem('address');
    if (name) name.value = place.name;
    if (address) address.value = place.address;
    name?.focus();
    closePanel();
  }, 450);
}

function bindClickedLocation(map, latLng) {
  document.querySelector(`#${PANEL_ID} [data-use-clicked-location]`)?.addEventListener('click', () => {
    suppressNextMapSearch = true;
    google.maps.event.trigger(map, 'click', { latLng });
    closePanel();
  });
}

function renderLoading(message) {
  renderPanel(`<div class="flyer-map-candidate-header"><div><strong>${escapeHtml(message)}</strong><small>少しお待ちください。</small></div><button type="button" data-close-candidates>×</button></div>`);
}

function renderPanel(html) {
  let panel = document.querySelector(`#${PANEL_ID}`);
  if (!panel) {
    panel = document.createElement('aside');
    panel.id = PANEL_ID;
    panel.className = 'flyer-map-candidate-panel';
    document.querySelector('.map-stage')?.appendChild(panel);
  }
  panel.innerHTML = html;
  panel.hidden = false;
  panel.querySelector('[data-close-candidates]')?.addEventListener('click', closePanel);
}

function closePanel() {
  const panel = document.querySelector(`#${PANEL_ID}`);
  if (panel) panel.hidden = true;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function injectStyles() {
  if (document.querySelector(`#${STYLE_ID}`)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .flyer-map-candidate-panel{position:fixed;z-index:48;right:max(16px,env(safe-area-inset-right));bottom:max(84px,env(safe-area-inset-bottom));width:min(390px,calc(100vw - 32px));max-height:min(62vh,560px);overflow:auto;background:#fff;border:1px solid #d9f4df;border-radius:24px;box-shadow:0 20px 60px rgba(15,23,42,.24);padding:16px}
    .flyer-map-candidate-panel[hidden]{display:none}
    .flyer-map-candidate-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
    .flyer-map-candidate-header strong{display:block;color:#17301f;font-size:1rem}
    .flyer-map-candidate-header small{display:block;color:#607568;line-height:1.45;margin-top:4px}
    .flyer-map-candidate-header button{min-width:42px;padding:8px;background:#eefdf2}
    .flyer-map-candidate-message{margin:0;color:#496250;line-height:1.55}
    .flyer-map-candidate-list{display:grid;gap:8px}
    .flyer-map-candidate{display:grid;text-align:left;gap:4px;width:100%;border:1px solid #d9f4df;border-radius:16px;background:#fbfffc;color:#17301f;padding:12px}
    .flyer-map-candidate span{font-size:.84rem;color:#607568;font-weight:600;line-height:1.4}
    .flyer-map-use-clicked{width:100%;margin-top:10px;background:#eefdf2;color:#14532d}
    @media(max-width:560px){.flyer-map-candidate-panel{left:12px;right:12px;bottom:82px;width:auto;max-height:50vh}.flyer-map-candidate,.flyer-map-use-clicked{min-height:52px}}
  `;
  document.head.appendChild(style);
}
