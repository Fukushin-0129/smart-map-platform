import assert from 'node:assert/strict';
import test from 'node:test';

import { isSaladRelatedStore } from '../src/modules/saladMap.js';

test('layerIdが無い手入力店舗はサラダマップ対象とする', () => {
  const store = { name: 'カフェA', category: '喫茶店', description: '' };
  assert.equal(isSaladRelatedStore(store, undefined), true);
});

test('レイヤー名に「サラダ」を含むKML店舗はサラダマップ対象とする', () => {
  const store = { layerId: 'layer-1', layerName: '北摂サラダマップ', category: '', description: '' };
  const layer = { name: '北摂サラダマップ', fileName: 'salad.kml' };
  assert.equal(isSaladRelatedStore(store, layer), true);
});

test('カテゴリに"salad"を含む店舗はサラダマップ対象とする', () => {
  const store = { layerId: 'layer-2', layerName: '', category: 'Salad Bar', description: '' };
  const layer = { name: '飲食店マップ', fileName: 'food.kml' };
  assert.equal(isSaladRelatedStore(store, layer), true);
});

test('サラダに無関係なKML店舗は対象外とする', () => {
  const store = { layerId: 'layer-3', layerName: 'チラシ配布', category: '不動産', description: '賃貸物件' };
  const layer = { name: '不動産マップ', fileName: 'realestate.kml' };
  assert.equal(isSaladRelatedStore(store, layer), false);
});
