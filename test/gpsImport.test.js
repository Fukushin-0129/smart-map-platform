import assert from 'node:assert/strict';
import test from 'node:test';

import { readPhotoGpsFromBuffer } from '../src/modules/gpsImport.js';

test('JPEGのExif GPSを取得できる', () => {
  const jpeg = concat(Uint8Array.from([0xff, 0xd8, 0xff, 0xe1]), ascii('Exif\0\0'), createGpsTiff());
  assert.deepEqual(readPhotoGpsFromBuffer(jpeg.buffer), { lat: 35.5, lng: 139.75 });
});

test('HEIC内のExif GPSを取得できる', () => {
  const heic = concat(ascii('\0\0\0\u0018ftypheic\0\0\0\0heicmif1'), ascii('Exif\0\0'), createGpsTiff());
  assert.deepEqual(readPhotoGpsFromBuffer(heic.buffer), { lat: 35.5, lng: 139.75 });
});

test('GPS情報がない画像はnullを返す', () => {
  assert.equal(readPhotoGpsFromBuffer(ascii('not an exif image').buffer), null);
});

function createGpsTiff() {
  const bytes = new Uint8Array(128);
  const view = new DataView(bytes.buffer);
  bytes.set(ascii('II'), 0);
  view.setUint16(2, 42, true);
  view.setUint32(4, 8, true);
  view.setUint16(8, 1, true);
  writeEntry(view, 10, 0x8825, 4, 1, 26);
  view.setUint16(26, 4, true);
  writeAsciiEntry(view, bytes, 28, 0x0001, 'N');
  writeEntry(view, 40, 0x0002, 5, 3, 80);
  writeAsciiEntry(view, bytes, 52, 0x0003, 'E');
  writeEntry(view, 64, 0x0004, 5, 3, 104);
  writeRationals(view, 80, [[35, 1], [30, 1], [0, 1]]);
  writeRationals(view, 104, [[139, 1], [45, 1], [0, 1]]);
  return bytes;
}

function writeEntry(view, offset, tag, type, count, value) {
  view.setUint16(offset, tag, true);
  view.setUint16(offset + 2, type, true);
  view.setUint32(offset + 4, count, true);
  view.setUint32(offset + 8, value, true);
}

function writeAsciiEntry(view, bytes, offset, tag, value) {
  writeEntry(view, offset, tag, 2, 2, 0);
  bytes[offset + 8] = value.charCodeAt(0);
}

function writeRationals(view, offset, values) {
  values.forEach(([numerator, denominator], index) => {
    view.setUint32(offset + index * 8, numerator, true);
    view.setUint32(offset + index * 8 + 4, denominator, true);
  });
}

function ascii(value) {
  return Uint8Array.from(value, (character) => character.charCodeAt(0));
}

function concat(...arrays) {
  const result = new Uint8Array(arrays.reduce((total, array) => total + array.length, 0));
  let offset = 0;
  arrays.forEach((array) => {
    result.set(array, offset);
    offset += array.length;
  });
  return result;
}
