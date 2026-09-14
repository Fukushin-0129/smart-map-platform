import { FLYER_LAYER, FLYER_STATUSES } from './constants.js';
import { isValidCoordinate } from './utils.js';

export function parseCsv(text) {
  const rows = [];
  let row = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i], next = text[i + 1];
    if (char === '"' && quoted && next === '"') { value += '"'; i += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === ',' && !quoted) { row.push(value); value = ''; continue; }
    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(value); rows.push(row); row = []; value = ''; continue;
    }
    value += char;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim()));
}

export function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function flyerMatchKey(apt) {
  return [String(apt.no || '').trim(), String(apt.name || '').trim(), Number(apt.lat).toFixed(6), Number(apt.lng).toFixed(6)].join('|');
}

export function normalizeFlyerStatus(unitStatus, distributionDate) {
  const text = `${unitStatus} ${distributionDate}`.trim();
  if (FLYER_STATUSES.includes(unitStatus)) return unitStatus;
  if (/不可|対象外|NG|断り/.test(text)) return '配布不可';
  if (/不在|留守/.test(text)) return '不在';
  if (distributionDate || /済|完了/.test(text)) return '配布済み';
  return '未配布';
}

export function normalizeFlyerAssignee(name, flyerAssignees) {
  const trimmed = String(name || '').trim();
  return flyerAssignees.includes(trimmed) ? trimmed : '';
}

export function findSavedFlyer(no, name, lat, lng, flyerApartments) {
  const key = [String(no || '').trim(), String(name || '').trim(), Number(lat).toFixed(6), Number(lng).toFixed(6)].join('|');
  return flyerApartments.find((apt) => flyerMatchKey(apt) === key)
    || flyerApartments.find((apt) => apt.no && String(apt.no) === String(no) && apt.name === name)
    || flyerApartments.find((apt) => apt.name === name && Number(apt.lat).toFixed(6) === Number(lat).toFixed(6) && Number(apt.lng).toFixed(6) === Number(lng).toFixed(6));
}

export function rowsToFlyerApartments(rows, flyerApartments, flyerAssignees) {
  const headerIndex = rows.findIndex((row) => row.map((cell) => cell.trim().replace(/^\ufeff/, '')).slice(0, 3).join('|') === 'No.|物件名|エリア');
  if (headerIndex < 0) throw new Error('「No.」「物件名」「エリア」から始まる見出し行が見つかりませんでした。');
  const headers = rows[headerIndex].map((h) => h.trim().replace(/^\ufeff/, ''));
  const indexOf = (...names) => names.map((name) => headers.indexOf(name)).find((index) => index >= 0) ?? -1;
  const importedAt = new Date().toISOString();
  const imported = rows.slice(headerIndex + 1).map((row) => {
    const get = (...names) => row[indexOf(...names)]?.trim() || '';
    const coordText = get('緯度・経度', '緯度経度', '座標');
    const latText = get('緯度', 'lat', 'latitude') || coordText;
    const lngText = get('経度', 'lng', 'lon', 'longitude');
    const splitCoord = latText && !lngText && latText.includes(',') ? latText.split(',').map((v) => Number(v.trim())) : null;
    const lat = splitCoord ? splitCoord[0] : Number(latText);
    const lng = splitCoord ? splitCoord[1] : Number(lngText);
    if (!isValidCoordinate(lat, lng)) return null;
    const distributionDate = get('配布日');
    const no = get('No.', 'No', '番号');
    const name = get('物件名', '建物名', 'マンション名', '名称') || '名称未設定';
    const saved = findSavedFlyer(no, name, lat, lng, flyerApartments);
    const status = normalizeFlyerStatus(get('配布状況', 'ステータス', '戸数状態'), distributionDate);
    return {
      id: saved?.id || crypto.randomUUID(),
      no,
      layerId: FLYER_LAYER.id,
      layerName: FLYER_LAYER.name,
      name,
      area: get('エリア'),
      type: get('種別'),
      schoolDistrict: get('小学校区'),
      units: get('戸数'),
      unitStatus: get('戸数状態'),
      distributionDate: saved?.distributionDate || distributionDate || '',
      nextDistribution: get('次回配布'),
      memo: saved?.memo || get('備考', 'メモ'),
      lat,
      lng,
      status: saved?.status || status,
      assignee: saved?.assignee || normalizeFlyerAssignee(get('担当者', '担当'), flyerAssignees),
      deliveredCount: saved?.deliveredCount || get('配布枚数') || '',
      photos: saved?.photos || [],
      createdAt: saved?.createdAt || importedAt,
      updatedAt: saved?.updatedAt || importedAt,
    };
  }).filter(Boolean);
  return imported;
}

export function mergeFlyerApartments(imported, flyerApartments) {
  const importedKeys = new Set(imported.map(flyerMatchKey));
  return [...imported, ...flyerApartments.filter((apt) => !importedKeys.has(flyerMatchKey(apt)))];
}
