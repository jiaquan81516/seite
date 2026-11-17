import { imageFormat, isHeifFormat, MAX_PHOTO_BYTES } from './image-formats';

async function decodeImage(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('Empty image.');
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function convertHeif(blob) {
  // Lazy-load a local decoder only when native Safari/browser decoding fails.
  // No original photo is sent to a conversion service.
  const { heicTo } = await import('heic-to/csp');
  return heicTo({ blob, type: 'image/jpeg', quality: 0.92 });
}

function jpegPreview(image) {
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 2000 / Math.max(image.naturalWidth, image.naturalHeight));
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser could not prepare this photo.');
  context.fillStyle = 'white';
  context.fillRect(0, 0, canvas.width, canvas.height);
  // Drawing the decoded pixels respects browser photo orientation and drops EXIF
  // metadata (including location) when the new JPEG is encoded.
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.9, 0.8, 0.65]) {
    const url = canvas.toDataURL('image/jpeg', quality);
    const data = url.split(',')[1];
    if (url.startsWith('data:image/jpeg;base64,') && data?.length <= 5_000_000)
      return data;
  }
  throw new Error('This photo is still too large. Crop it to the receipt and try again.');
}

export async function imageAttachment(file) {
  if (file.size > MAX_PHOTO_BYTES) throw new Error('Choose a photo smaller than 20 MB.');
  if (!file.size) throw new Error('This photo is empty. Choose another image.');
  const format = await imageFormat(file);
  if (!format)
    throw new Error(
      'Choose an iPhone photo (HEIC/HEIF), JPG, PNG, WebP or AVIF image, or a PDF.',
    );
  const blob = file.type === format ? file : new Blob([file], { type: format });
  let image;
  try {
    image = await decodeImage(blob);
  } catch {
    if (!isHeifFormat(format))
      throw new Error(
        'This photo couldn’t be opened. Choose another photo or screenshot.',
      );
    try {
      image = await decodeImage(await convertHeif(blob));
    } catch {
      throw new Error(
        'This iPhone photo couldn’t be converted. Try another photo or a screenshot.',
      );
    }
  }
  return { name: file.name, mediaType: 'image/jpeg', data: jpegPreview(image) };
}
