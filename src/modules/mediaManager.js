function getCrypto() {
  return globalThis.crypto;
}

export async function createMediaItem(file, options = {}) {
  const buffer = await file.arrayBuffer();
  const hash = await sha256(buffer);
  return {
    id: options.id || getCrypto()?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    name: file.name || '写真',
    type: file.type || '',
    size: Number(file.size) || buffer.byteLength,
    hash,
    dataUrl: options.dataUrl || '',
    caption: options.caption || '',
    lat: options.lat ?? null,
    lng: options.lng ?? null,
    takenAt: options.takenAt || null,
    importedAt: options.importedAt || new Date().toISOString(),
    isMain: Boolean(options.isMain),
  };
}

export async function sha256(buffer) {
  const subtle = getCrypto()?.subtle;
  if (!subtle) throw new Error('このブラウザでは写真の重複確認を利用できません。');
  const digest = await subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function findDuplicateMedia(mediaItems, candidate) {
  if (!candidate?.hash) return null;
  return mediaItems.find((item) => item.hash === candidate.hash) || null;
}

export function collectStoreMedia(stores = []) {
  return stores.flatMap((store) => store.photos || []);
}

export function addMedia(mediaItems, item) {
  if (findDuplicateMedia(mediaItems, item)) return mediaItems;
  const next = mediaItems.length ? item : { ...item, isMain: true };
  return [...mediaItems, next];
}

export function updateMedia(mediaItems, mediaId, changes) {
  return mediaItems.map((item) => item.id === mediaId ? { ...item, ...changes, id: item.id } : item);
}

export function removeMedia(mediaItems, mediaId) {
  const removed = mediaItems.find((item) => item.id === mediaId);
  const remaining = mediaItems.filter((item) => item.id !== mediaId);
  if (removed?.isMain && remaining.length) remaining[0] = { ...remaining[0], isMain: true };
  return remaining;
}

export function moveMedia(mediaItems, mediaId, direction) {
  const from = mediaItems.findIndex((item) => item.id === mediaId);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= mediaItems.length) return mediaItems;
  const next = [...mediaItems];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export function setMainMedia(mediaItems, mediaId) {
  return mediaItems.map((item) => ({ ...item, isMain: item.id === mediaId }));
}
