import { isValidCoordinate } from './utils.js';

export class PhotoGpsError extends Error {}

export async function readPhotoGps(file) {
  const buffer = await file.arrayBuffer();
  return readPhotoGpsFromBuffer(buffer);
}

export function readPhotoGpsFromBuffer(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 8) return null;

  // JPEG stores Exif in an APP1 segment. HEIC stores the same TIFF payload in
  // an Exif item, so scanning for a valid Exif/TIFF header also covers HEIC
  // without requiring the browser to decode the image itself.
  for (let offset = 0; offset <= view.byteLength - 8; offset += 1) {
    if (getAscii(view, offset, 6) === 'Exif\0\0') {
      const gps = parseTiffGps(view, offset + 6);
      if (gps) return gps;
    }
  }

  // Some HEIF writers omit the Exif identifier and start the item directly
  // with a TIFF header (optionally after the four-byte HEIF offset field).
  for (let offset = 0; offset <= view.byteLength - 8; offset += 1) {
    const order = getAscii(view, offset, 2);
    if ((order === 'II' && view.getUint16(offset + 2, true) === 42)
      || (order === 'MM' && view.getUint16(offset + 2, false) === 42)) {
      const gps = parseTiffGps(view, offset);
      if (gps) return gps;
    }
  }
  return null;
}

function parseTiffGps(view, tiffOffset) {
  try {
    if (tiffOffset + 8 > view.byteLength) return null;
    const byteOrder = getAscii(view, tiffOffset, 2);
    if (!['II', 'MM'].includes(byteOrder)) return null;
    const littleEndian = byteOrder === 'II';
    if (getUint16(view, tiffOffset + 2, littleEndian) !== 42) return null;
    const firstIfdOffset = getUint32(view, tiffOffset + 4, littleEndian);
    const firstIfd = tiffOffset + firstIfdOffset;
    if (!isRange(view, firstIfd, 2)) return null;
    const gpsIfdPointer = findIfdValue(view, firstIfd, 0x8825, littleEndian, tiffOffset);
    if (!Number.isInteger(gpsIfdPointer)) return null;

    const gpsIfd = tiffOffset + gpsIfdPointer;
    const latRef = findIfdValue(view, gpsIfd, 0x0001, littleEndian, tiffOffset);
    const latValue = findIfdValue(view, gpsIfd, 0x0002, littleEndian, tiffOffset);
    const lngRef = findIfdValue(view, gpsIfd, 0x0003, littleEndian, tiffOffset);
    const lngValue = findIfdValue(view, gpsIfd, 0x0004, littleEndian, tiffOffset);
    if (!latRef || !latValue || !lngRef || !lngValue) return null;

    const lat = convertGpsCoordinate(latValue, latRef);
    const lng = convertGpsCoordinate(lngValue, lngRef);
    return isValidCoordinate(lat, lng) ? { lat, lng } : null;
  } catch (error) {
    if (error instanceof RangeError) return null;
    throw error;
  }
}

function findIfdValue(view, ifdOffset, tag, littleEndian, tiffOffset) {
  if (!isRange(view, ifdOffset, 2)) return null;
  const count = getUint16(view, ifdOffset, littleEndian);
  if (count > 512 || !isRange(view, ifdOffset + 2, count * 12)) return null;
  for (let index = 0; index < count; index += 1) {
    const entry = ifdOffset + 2 + index * 12;
    if (getUint16(view, entry, littleEndian) !== tag) continue;
    const type = getUint16(view, entry + 2, littleEndian);
    const values = getUint32(view, entry + 4, littleEndian);
    const bytes = values * typeByteSize(type);
    if (!bytes || values > 1024) return null;
    const valueOffset = bytes <= 4 ? entry + 8 : tiffOffset + getUint32(view, entry + 8, littleEndian);
    if (!isRange(view, valueOffset, bytes)) return null;
    if (type === 2) return getAscii(view, valueOffset, values).replace(/\0/g, '');
    if (type === 5) return Array.from({ length: values }, (_, itemIndex) => {
      const rationalOffset = valueOffset + itemIndex * 8;
      const numerator = getUint32(view, rationalOffset, littleEndian);
      const denominator = getUint32(view, rationalOffset + 4, littleEndian);
      return denominator ? numerator / denominator : 0;
    });
    return getUint32(view, entry + 8, littleEndian);
  }
  return null;
}

function convertGpsCoordinate(parts, ref) {
  if (!Array.isArray(parts) || parts.length < 3) return NaN;
  const value = parts[0] + parts[1] / 60 + parts[2] / 3600;
  return ['S', 'W'].includes(ref.toUpperCase()) ? -value : value;
}

function typeByteSize(type) {
  return { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8 }[type] || 0;
}

function isRange(view, offset, length) {
  return Number.isInteger(offset) && Number.isInteger(length) && offset >= 0 && length >= 0 && offset + length <= view.byteLength;
}

function getUint16(view, offset, littleEndian) {
  return view.getUint16(offset, littleEndian);
}

function getUint32(view, offset, littleEndian) {
  return view.getUint32(offset, littleEndian);
}

function getAscii(view, offset, length) {
  if (!isRange(view, offset, length)) return '';
  return Array.from({ length }, (_, index) => String.fromCharCode(view.getUint8(offset + index))).join('');
}
