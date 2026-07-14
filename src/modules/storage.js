import { ASSIGNEES_STORAGE_KEY, DEFAULT_ASSIGNEES, DISPLAY_MODE_STORAGE_KEY, FLYER_STORAGE_KEY, FLYER_MIGRATION_STORAGE_KEY, FLYER_SYNC_QUEUE_STORAGE_KEY, LAYERS_STORAGE_KEY, LAYER_VISIBILITY_STORAGE_KEY, MAP_VIEW_STORAGE_KEY, PHOTO_IMPORT_STORAGE_KEY, STORAGE_KEY } from './constants.js';

export function loadStores() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
}
export function loadLayers() {
  try { return JSON.parse(localStorage.getItem(LAYERS_STORAGE_KEY)) || []; } catch { return []; }
}
export function loadLayerVisibility() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LAYER_VISIBILITY_STORAGE_KEY));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}
export function loadPhotoImports() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PHOTO_IMPORT_STORAGE_KEY)) || {};
    return { candidates: parsed.candidates || [], unclassified: parsed.unclassified || [] };
  } catch { return { candidates: [], unclassified: [] }; }
}
export function loadFlyerApartments() {
  try { return JSON.parse(localStorage.getItem(FLYER_STORAGE_KEY)) || []; } catch { return []; }
}
export function loadFlyerAssignees() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ASSIGNEES_STORAGE_KEY));
    return Array.isArray(parsed) ? [...parsed, ...DEFAULT_ASSIGNEES].slice(0, 10) : DEFAULT_ASSIGNEES;
  } catch { return DEFAULT_ASSIGNEES; }
}
export function saveStores(stores) { localStorage.setItem(STORAGE_KEY, JSON.stringify(stores)); }
export function saveLayers(layers) { localStorage.setItem(LAYERS_STORAGE_KEY, JSON.stringify(layers)); }
export function saveLayerVisibility(layerVisibility) { localStorage.setItem(LAYER_VISIBILITY_STORAGE_KEY, JSON.stringify(layerVisibility)); }
export function savePhotoImports(photoImports) { localStorage.setItem(PHOTO_IMPORT_STORAGE_KEY, JSON.stringify(photoImports)); }
export function saveFlyerApartments(flyerApartments) { localStorage.setItem(FLYER_STORAGE_KEY, JSON.stringify(flyerApartments)); }
export function hasMigratedFlyerPlaces() { try { return localStorage.getItem(FLYER_MIGRATION_STORAGE_KEY) === 'done'; } catch { return false; } }
export function markFlyerPlacesMigrated() { localStorage.setItem(FLYER_MIGRATION_STORAGE_KEY, 'done'); }
export function loadFlyerSyncQueue() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FLYER_SYNC_QUEUE_STORAGE_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
export function saveFlyerSyncQueue(queue) { localStorage.setItem(FLYER_SYNC_QUEUE_STORAGE_KEY, JSON.stringify(queue)); }
export function saveFlyerAssignees(flyerAssignees) { localStorage.setItem(ASSIGNEES_STORAGE_KEY, JSON.stringify(flyerAssignees)); }
export function loadDisplayMode() { try { return localStorage.getItem(DISPLAY_MODE_STORAGE_KEY) || 'all'; } catch { return 'all'; } }
export function saveDisplayMode(displayMode) { localStorage.setItem(DISPLAY_MODE_STORAGE_KEY, displayMode); }
export function loadMapView() {
  try {
    const parsed = JSON.parse(localStorage.getItem(MAP_VIEW_STORAGE_KEY));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch { return null; }
}
export function saveMapView(mapView) { localStorage.setItem(MAP_VIEW_STORAGE_KEY, JSON.stringify(mapView)); }
