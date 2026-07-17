import { FLYER_STORAGE_KEY, FLYER_SYNC_QUEUE_STORAGE_KEY } from './constants.js';

const importMetaEnv = import.meta.env || {};
const SUPABASE_URL = importMetaEnv.VITE_SUPABASE_URL || window.SMART_MAP_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = importMetaEnv.VITE_SUPABASE_ANON_KEY || window.SMART_MAP_SUPABASE_ANON_KEY || '';
const TABLE = 'flyer_places';
const BUTTON_ATTRIBUTE = 'data-delete-flyer-place';

export function initializeFlyerDelete() {
  injectStyles();
  const observer = new MutationObserver(addDeleteButtonToOpenFlyer);
  observer.observe(document.body, { childList: true, subtree: true });
  addDeleteButtonToOpenFlyer();
}

function addDeleteButtonToOpenFlyer() {
  const card = document.querySelector('[data-flyer-detail-card]');
  const detailBody = card?.closest('.place-detail-body');
  if (!card || !detailBody || detailBody.querySelector(`[${BUTTON_ATTRIBUTE}]`)) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'flyer-delete-button';
  button.setAttribute(BUTTON_ATTRIBUTE, '');
  button.textContent = 'このデータを削除';
  button.addEventListener('click', () => deleteFlyerPlace(card.dataset.flyerDetailCard, button));
  detailBody.appendChild(button);
}

async function deleteFlyerPlace(id, button) {
  if (!id) return;
  const title = document.querySelector('.place-detail-header h2')?.textContent?.trim() || 'この配布先';
  const confirmed = window.confirm(`「${title}」を削除しますか？\n\nこの操作は元に戻せません。`);
  if (!confirmed) return;

  button.disabled = true;
  button.textContent = '削除しています…';

  try {
    if (isSupabaseConfigured()) {
      const result = await deleteFromSupabase(id);
      if (!result.ok) throw new Error(result.reason);
    }

    removeFromLocalStorage(FLYER_STORAGE_KEY, id);
    removeFromLocalStorage(FLYER_SYNC_QUEUE_STORAGE_KEY, id);
    window.alert('データを削除しました。');
    window.location.reload();
  } catch (error) {
    console.error('チラシ配布先を削除できませんでした。', error);
    window.alert(`削除できませんでした。通信状態を確認して、もう一度お試しください。\n\n${error.message || ''}`);
    button.disabled = false;
    button.textContent = 'このデータを削除';
  }
}

async function deleteFromSupabase(id) {
  try {
    const response = await fetch(`${normalizeUrl(SUPABASE_URL)}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
    });
    if (!response.ok) throw new Error(`Supabase削除エラー: ${response.status}`);
    return { ok: true, reason: '' };
  } catch (error) {
    return { ok: false, reason: error.message || 'Supabase削除失敗' };
  }
}

function removeFromLocalStorage(key, id) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    if (!Array.isArray(parsed)) return;
    localStorage.setItem(key, JSON.stringify(parsed.filter((item) => item?.id !== id)));
  } catch (error) {
    console.warn(`${key} から削除対象を取り除けませんでした。`, error);
  }
}

function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function normalizeUrl(url) {
  return url.replace(/\/$/, '');
}

function injectStyles() {
  if (document.querySelector('#flyerDeleteStyles')) return;
  const style = document.createElement('style');
  style.id = 'flyerDeleteStyles';
  style.textContent = `
    .flyer-delete-button {
      width: 100%;
      margin-top: 18px;
      min-height: 50px;
      border: 2px solid #dc2626;
      border-radius: 14px;
      background: #fff;
      color: #b91c1c;
      font-weight: 900;
    }
    .flyer-delete-button:hover { background: #fef2f2; }
    .flyer-delete-button:disabled { opacity: .6; cursor: wait; }
  `;
  document.head.appendChild(style);
}
