import { ASSIGNEES_STORAGE_KEY, DEFAULT_ASSIGNEES, FLYER_STORAGE_KEY, LAYERS_STORAGE_KEY, PHOTO_IMPORT_STORAGE_KEY, STORAGE_KEY } from './constants.js';

export function loadStores() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
}
export function loadLayers() {
  try { return JSON.parse(localStorage.getItem(LAYERS_STORAGE_KEY)) || []; } catch { return []; }
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
export function savePhotoImports(photoImports) { localStorage.setItem(PHOTO_IMPORT_STORAGE_KEY, JSON.stringify(photoImports)); }
export function saveFlyerApartments(flyerApartments) { localStorage.setItem(FLYER_STORAGE_KEY, JSON.stringify(flyerApartments)); }
export function saveFlyerAssignees(flyerAssignees) { localStorage.setItem(ASSIGNEES_STORAGE_KEY, JSON.stringify(flyerAssignees)); }
