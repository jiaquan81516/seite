export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
const MIME_TYPES = new Map([
  ['image/jpeg', 'image/jpeg'],
  ['image/jpg', 'image/jpeg'],
  ['image/pjpeg', 'image/jpeg'],
  ['image/png', 'image/png'],
  ['image/webp', 'image/webp'],
  ['image/avif', 'image/avif'],
  ['image/heic', 'image/heic'],
  ['image/heif', 'image/heif'],
  ['image/heic-sequence', 'image/heic'],
  ['image/heif-sequence', 'image/heif'],
]);
const EXTENSIONS = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  heic: 'image/heic',
  heif: 'image/heif',
  heics: 'image/heic',
  heifs: 'image/heif',
};
const HEIF_BRANDS = new Set([
  'heic',
  'heix',
  'hevc',
  'hevx',
  'heim',
  'heis',
  'mif1',
  'msf1',
]);

export async function imageFormat(file) {
  const mime = file.type.toLowerCase();
  if (MIME_TYPES.has(mime)) return MIME_TYPES.get(mime);
  const extension = file.name.split('.').at(-1).toLowerCase();
  // iOS Files/AirDrop can omit the MIME type or use a generic binary type.
  if (!mime || mime === 'application/octet-stream') {
    if (EXTENSIONS[extension]) return EXTENSIONS[extension];
    const header = new Uint8Array(await file.slice(0, 64).arrayBuffer());
    const text = String.fromCharCode(...header);
    if (text.slice(4, 8) === 'ftyp') {
      const brands = [];
      for (let offset = 8; offset + 4 <= text.length; offset += 4)
        brands.push(text.slice(offset, offset + 4));
      if (brands.includes('avif') || brands.includes('avis')) return 'image/avif';
      if (brands.some((brand) => HEIF_BRANDS.has(brand))) return 'image/heic';
    }
  }
  return null;
}

export const isHeifFormat = (format) =>
  format === 'image/heic' || format === 'image/heif';
