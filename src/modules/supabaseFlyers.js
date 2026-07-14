import { FLYER_LAYER } from './constants.js';

const importMetaEnv = import.meta.env || {};
const SUPABASE_URL = importMetaEnv.VITE_SUPABASE_URL || window.SMART_MAP_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = importMetaEnv.VITE_SUPABASE_ANON_KEY || window.SMART_MAP_SUPABASE_ANON_KEY || '';
const TABLE = 'flyer_places';

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export async function loadFlyerPlacesFromSupabase() {
  if (!isSupabaseConfigured()) return { ok: false, places: [], reason: 'Supabase未設定' };
  try {
    const response = await fetch(`${normalizeUrl(SUPABASE_URL)}/rest/v1/${TABLE}?select=*&order=updated_at.desc.nullslast`, {
      headers: supabaseHeaders(),
    });
    if (!response.ok) throw new Error(`Supabase読み込みエラー: ${response.status}`);
    const rows = await response.json();
    return { ok: true, places: rows.map(rowToFlyerApartment), reason: '' };
  } catch (error) {
    console.error('Supabaseからチラシ配布データを読み込めませんでした。localStorageを使用します。', error);
    return { ok: false, places: [], reason: error.message || 'Supabase接続失敗' };
  }
}

export async function saveFlyerPlacesToSupabase(flyerApartments) {
  if (!isSupabaseConfigured()) return { ok: false, reason: 'Supabase未設定' };
  const rows = flyerApartments.map(flyerApartmentToRow);
  if (!rows.length) return { ok: true, reason: '' };
  try {
    const response = await fetch(`${normalizeUrl(SUPABASE_URL)}/rest/v1/${TABLE}?on_conflict=id`, {
      method: 'POST',
      headers: { ...supabaseHeaders(), Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(rows),
    });
    if (!response.ok) throw new Error(`Supabase保存エラー: ${response.status}`);
    return { ok: true, reason: '' };
  } catch (error) {
    console.error('Supabaseへチラシ配布データを保存できませんでした。localStorageのバックアップは維持されています。', error);
    return { ok: false, reason: error.message || 'Supabase保存失敗' };
  }
}

function supabaseHeaders() {
  return { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' };
}

function normalizeUrl(url) { return url.replace(/\/$/, ''); }

function rowToFlyerApartment(row) {
  return {
    id: row.id,
    layerId: FLYER_LAYER.id,
    layerName: FLYER_LAYER.name,
    name: row.name || '名称未設定',
    address: row.address || '',
    lat: Number(row.latitude),
    lng: Number(row.longitude),
    status: row.status || '未配布',
    assignee: row.assignee || '',
    distributionDate: row.distributed_at || '',
    deliveredCount: row.quantity ?? '',
    memo: row.memo || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
    photos: [],
  };
}

function flyerApartmentToRow(apt) {
  const now = new Date().toISOString();
  return {
    id: apt.id,
    name: apt.name || '名称未設定',
    address: apt.address || '',
    latitude: Number(apt.lat),
    longitude: Number(apt.lng),
    status: apt.status || '未配布',
    assignee: apt.assignee || '',
    distributed_at: apt.distributionDate || null,
    quantity: apt.deliveredCount === '' || apt.deliveredCount === undefined || apt.deliveredCount === null ? null : Number(apt.deliveredCount),
    memo: apt.memo || '',
    created_at: apt.createdAt || now,
    updated_at: apt.updatedAt || now,
  };
}
