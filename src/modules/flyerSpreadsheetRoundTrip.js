import { FLYER_LAYER, FLYER_STORAGE_KEY, FLYER_STATUSES } from './constants.js';
import { isSupabaseConfigured, saveFlyerPlacesToSupabase } from './supabaseFlyers.js';

const EXPORT_BUTTON_ID = 'exportFlyerSpreadsheetCsvButton';
const IMPORT_INPUT_ID = 'importFlyerSpreadsheetCsvInput';
const STATUS_ID = 'flyerSpreadsheetRoundTripStatus';

const HEADERS = [
  'ID', 'マンション名', '住所', '緯度', '経度', '戸数', '配布状況', '配布日',
  '配布枚数', '担当者', 'メモ', '作成日時', '更新日時',
];

export function initializeFlyerSpreadsheetRoundTrip() {
  const observer = new MutationObserver(installControls);
  observer.observe(document.body, { childList: true, subtree: true });
  installControls();
}

function installControls() {
  if (document.querySelector(`#${EXPORT_BUTTON_ID}`)) return;
  const exportPanel = document.querySelector('[data-panel="csv-export"]');
  const importPanel = document.querySelector('[data-panel="csv"]');
  if (!exportPanel || !importPanel) return;

  const exportBlock = document.createElement('div');
  exportBlock.className = 'spreadsheet-roundtrip-block';
  exportBlock.innerHTML = `
    <hr class="panel-divider" />
    <h2>スプレッドシート往復</h2>
    <p class="hint">ID付きCSVを出力します。Googleスプレッドシート、Excel、Numbersで戸数などを編集し、同じCSVを下の入力から書き戻せます。</p>
    <button type="button" id="${EXPORT_BUTTON_ID}" class="primary flyer-route-button">ID付きCSVをエクスポート</button>`;
  exportPanel.appendChild(exportBlock);

  const importBlock = document.createElement('div');
  importBlock.className = 'spreadsheet-roundtrip-block';
  importBlock.innerHTML = `
    <hr class="panel-divider" />
    <h2>編集済みCSVを書き戻す</h2>
    <label>ID付きCSV
      <input id="${IMPORT_INPUT_ID}" type="file" accept=".csv,text/csv" />
    </label>
    <p class="hint">IDが一致する行は既存データを更新します。IDが空欄の行は、緯度・経度が正しければ新規登録します。ID列は変更しないでください。</p>
    <p id="${STATUS_ID}" class="import-status" aria-live="polite"></p>`;
  importPanel.appendChild(importBlock);

  document.querySelector(`#${EXPORT_BUTTON_ID}`)?.addEventListener('click', exportRoundTripCsv);
  document.querySelector(`#${IMPORT_INPUT_ID}`)?.addEventListener('change', importRoundTripCsv);
}

function exportRoundTripCsv() {
  const items = loadFlyers();
  if (!items.length) {
    setStatus('エクスポートするチラシ配布データがありません。');
    return;
  }

  const rows = items.map((apt) => [
    apt.id || '', apt.name || '', apt.address || '', apt.lat ?? '', apt.lng ?? '', apt.units ?? '',
    apt.status || '未配布', apt.distributionDate || '', apt.deliveredCount ?? '', apt.assignee || '',
    apt.memo || '', apt.createdAt || '', apt.updatedAt || '',
  ]);
  const csv = `\ufeff${[HEADERS, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `flyer-database-${todayString()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setStatus(`${items.length}件をID付きCSVでエクスポートしました。`);
}

async function importRoundTripCsv(event) {
  const input = event.currentTarget;
  const file = input.files?.[0];
  if (!file) return;
  setStatus('CSVを確認しています…');

  try {
    const rows = parseCsv(await file.text());
    if (!rows.length) throw new Error('CSVにデータがありません。');
    const headers = rows[0].map(cleanHeader);
    if (!headers.includes('ID') || !headers.includes('マンション名')) {
      throw new Error('往復用CSVではありません。「ID」「マンション名」の列が必要です。');
    }

    const current = loadFlyers();
    const currentById = new Map(current.map((apt) => [String(apt.id), apt]));
    const imported = [];
    let updateCount = 0;
    let createCount = 0;
    let skipCount = 0;

    for (const row of rows.slice(1)) {
      if (!row.some((cell) => String(cell || '').trim())) continue;
      const get = (name) => String(row[headers.indexOf(name)] ?? '').trim();
      const idText = get('ID');
      const existing = idText ? currentById.get(idText) : null;
      const lat = numberOrFallback(get('緯度'), existing?.lat);
      const lng = numberOrFallback(get('経度'), existing?.lng);
      const name = get('マンション名') || existing?.name || '';
      if (!name || !validCoordinates(lat, lng)) {
        skipCount += 1;
        continue;
      }

      const now = new Date().toISOString();
      const item = {
        ...(existing || {}),
        id: existing?.id || idText || crypto.randomUUID(),
        layerId: FLYER_LAYER.id,
        layerName: FLYER_LAYER.name,
        name,
        address: get('住所'),
        lat,
        lng,
        units: integerOrBlank(get('戸数')),
        status: normalizeStatus(get('配布状況')),
        distributionDate: get('配布日'),
        deliveredCount: integerOrBlank(get('配布枚数')),
        assignee: get('担当者'),
        memo: get('メモ'),
        createdAt: existing?.createdAt || get('作成日時') || now,
        updatedAt: now,
        photos: existing?.photos || [],
      };
      imported.push(item);
      if (existing) updateCount += 1;
      else createCount += 1;
    }

    if (!imported.length) throw new Error('更新できる行がありません。マンション名と緯度・経度を確認してください。');
    const confirmation = `更新 ${updateCount}件、新規 ${createCount}件${skipCount ? `、読み飛ばし ${skipCount}件` : ''}です。書き戻しますか？`;
    if (!window.confirm(confirmation)) {
      setStatus('書き戻しをキャンセルしました。');
      return;
    }

    if (isSupabaseConfigured()) {
      const result = await saveFlyerPlacesToSupabase(imported);
      if (!result.ok) throw new Error(result.reason || 'Supabaseへの保存に失敗しました。');
    }

    const merged = new Map(current.map((apt) => [String(apt.id), apt]));
    imported.forEach((apt) => merged.set(String(apt.id), apt));
    localStorage.setItem(FLYER_STORAGE_KEY, JSON.stringify(Array.from(merged.values())));
    setStatus(`更新 ${updateCount}件、新規 ${createCount}件を書き戻しました。画面を再読み込みします。`);
    window.setTimeout(() => window.location.reload(), 500);
  } catch (error) {
    console.error('スプレッドシートCSVの書き戻しに失敗しました。', error);
    setStatus(error.message || 'CSVの書き戻しに失敗しました。');
  } finally {
    input.value = '';
  }
}

function loadFlyers() {
  try {
    const value = JSON.parse(localStorage.getItem(FLYER_STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function setStatus(message) {
  const status = document.querySelector(`#${STATUS_ID}`);
  if (status) status.textContent = message;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') { value += '"'; index += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === ',' && !quoted) { row.push(value); value = ''; continue; }
    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(value); rows.push(row); row = []; value = ''; continue;
    }
    value += char;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
}

function cleanHeader(value) { return String(value || '').trim().replace(/^\ufeff/, ''); }
function todayString() { return new Date().toLocaleDateString('sv-SE'); }
function validCoordinates(lat, lng) { return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180; }
function numberOrFallback(value, fallback) { const parsed = Number(value); return value !== '' && Number.isFinite(parsed) ? parsed : Number(fallback); }
function integerOrBlank(value) { if (value === '') return ''; const parsed = Number(value); return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : ''; }
function normalizeStatus(value) { return FLYER_STATUSES.includes(value) ? value : '未配布'; }
