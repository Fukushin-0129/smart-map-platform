const importMetaEnv = import.meta.env || {};
const SUPABASE_URL = importMetaEnv.VITE_SUPABASE_URL || window.SMART_MAP_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = importMetaEnv.VITE_SUPABASE_ANON_KEY || window.SMART_MAP_SUPABASE_ANON_KEY || '';
const TABLE = 'salad_map_state';
const STATE_ID = 'shared';

export function isSaladSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export async function loadSaladMapStateFromSupabase() {
  if (!isSaladSupabaseConfigured()) return { ok: false, state: emptyState(), reason: 'Supabase未設定' };

  try {
    const response = await fetch(`${normalizeUrl(SUPABASE_URL)}/rest/v1/${TABLE}?id=eq.${STATE_ID}&select=*&limit=1`, {
      headers: supabaseHeaders(),
    });
    if (!response.ok) throw new Error(`Supabase読み込みエラー: ${response.status}`);
    const [row] = await response.json();
    return { ok: true, state: row ? rowToState(row) : emptyState(), reason: '' };
  } catch (error) {
    console.error('Supabaseからサラダマップデータを読み込めませんでした。localStorageを使用します。', error);
    return { ok: false, state: emptyState(), reason: error.message || 'Supabase接続失敗' };
  }
}

export async function saveSaladMapStateToSupabase(state) {
  if (!isSaladSupabaseConfigured()) return { ok: false, reason: 'Supabase未設定' };

  try {
    const response = await fetch(`${normalizeUrl(SUPABASE_URL)}/rest/v1/${TABLE}?on_conflict=id`, {
      method: 'POST',
      headers: { ...supabaseHeaders(), Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify([{ id: STATE_ID, ...stateToRow(state), updated_at: new Date().toISOString() }]),
    });
    if (!response.ok) throw new Error(`Supabase保存エラー: ${response.status}`);
    return { ok: true, reason: '' };
  } catch (error) {
    console.error('Supabaseへサラダマップデータを保存できませんでした。localStorageのバックアップは維持されています。', error);
    return { ok: false, reason: error.message || 'Supabase保存失敗' };
  }
}

function emptyState() {
  return { stores: [], layers: [], layerVisibility: {} };
}

function rowToState(row) {
  return {
    stores: Array.isArray(row.stores) ? row.stores : [],
    layers: Array.isArray(row.layers) ? row.layers : [],
    layerVisibility: row.layer_visibility && typeof row.layer_visibility === 'object' ? row.layer_visibility : {},
  };
}

function stateToRow(state) {
  return {
    stores: Array.isArray(state?.stores) ? state.stores : [],
    layers: Array.isArray(state?.layers) ? state.layers : [],
    layer_visibility: state?.layerVisibility && typeof state.layerVisibility === 'object' ? state.layerVisibility : {},
  };
}

function supabaseHeaders() {
  return { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' };
}

function normalizeUrl(url) { return url.replace(/\/$/, ''); }
