import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { imageFormat, MAX_PHOTO_BYTES } from '../src/chat/image-formats';
import { imageAttachment } from '../src/chat/images';
import { heicTo } from 'heic-to/csp';
vi.mock('heic-to/csp', () => ({ heicTo: vi.fn() }));
const decode = vi.fn();
const revoke = vi.fn();
let canvas;
beforeEach(() => {
  decode.mockReset().mockResolvedValue();
  heicTo.mockReset().mockResolvedValue(new Blob(['converted'], { type: 'image/jpeg' }));
  vi.stubGlobal(
    'Image',
    class {
      naturalWidth = 4032;
      naturalHeight = 3024;
      decode() {
        return decode();
      }
    },
  );
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL() {
        return 'blob:local-photo';
      }
      static revokeObjectURL(url) {
        revoke(url);
      }
    },
  );
  canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ fillRect: vi.fn(), drawImage: vi.fn() }),
    toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,cHJvY2Vzc2Vk'),
  };
  const createElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag, ...args) =>
    tag === 'canvas' ? canvas : createElement(tag, ...args),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const photo = (type = 'image/heic', name = 'IMG_9359.HEIC') =>
  new File(['photo-data'], name, { type });

describe('iPhone photo format handling', () => {
  it.each(['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'])(
    'accepts %s',
    async (type) => {
      expect(await imageFormat(photo(type))).toMatch(/^image\/hei[cf]$/);
    },
  );
  it.each(['', 'application/octet-stream'])(
    'recognizes HEIC/HEIF with a missing or generic MIME type %j',
    async (type) => {
      expect(await imageFormat(photo(type, 'IMG_9359.HEIF'))).toBe('image/heif');
    },
  );
  it('recognizes the HEIF container header when filename and MIME are missing', async () => {
    const bytes = new Uint8Array([
      0,
      0,
      0,
      24,
      ...new TextEncoder().encode('ftypheic'),
      0,
      0,
      0,
      0,
    ]);
    const file = {
      type: '',
      name: 'photo',
      slice: () => ({ arrayBuffer: async () => bytes.buffer }),
    };
    expect(await imageFormat(file)).toBe('image/heic');
  });
  it('uses native decoding first, resizes the photo and produces JPEG without loading a converter', async () => {
    const result = await imageAttachment(photo());
    expect(result).toEqual({
      name: 'IMG_9359.HEIC',
      mediaType: 'image/jpeg',
      data: 'cHJvY2Vzc2Vk',
    });
    expect(canvas.width).toBe(2000);
    expect(canvas.height).toBe(1500);
    expect(heicTo).not.toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith('blob:local-photo');
  });
  it('converts HEIC locally when the browser cannot decode it natively', async () => {
    decode.mockRejectedValueOnce(new Error('Unsupported format'));
    const file = photo();
    const result = await imageAttachment(file);
    expect(heicTo).toHaveBeenCalledWith({
      blob: file,
      type: 'image/jpeg',
      quality: 0.92,
    });
    expect(result.mediaType).toBe('image/jpeg');
    expect(decode).toHaveBeenCalledTimes(2);
  });
  it('allows larger iPhone originals while enforcing the 20 MB photo cap', async () => {
    await expect(
      imageAttachment({ type: 'image/jpeg', name: 'large.jpg', size: 12 * 1024 * 1024 }),
    ).resolves.toHaveProperty('mediaType', 'image/jpeg');
    await expect(imageAttachment({ size: MAX_PHOTO_BYTES + 1 })).rejects.toThrow('20 MB');
  });
  it('shows an actionable error if a HEIC photo cannot be decoded or converted', async () => {
    decode.mockRejectedValue(new Error('Unsupported'));
    heicTo.mockRejectedValue(new Error('Invalid HEIF'));
    await expect(imageAttachment(photo())).rejects.toThrow(
      'iPhone photo couldn’t be converted',
    );
  });
  it('retries encoding at lower quality before exceeding the API payload budget', async () => {
    canvas.toDataURL.mockReturnValueOnce(
      'data:image/jpeg;base64,' + 'A'.repeat(5_000_001),
    );
    await imageAttachment(photo('image/jpeg', 'photo.jpg'));
    expect(canvas.toDataURL).toHaveBeenNthCalledWith(1, 'image/jpeg', 0.9);
    expect(canvas.toDataURL).toHaveBeenNthCalledWith(2, 'image/jpeg', 0.8);
  });
  it('rejects unsupported active image formats before decoding', async () => {
    await expect(imageAttachment(photo('image/svg+xml', 'drawing.svg'))).rejects.toThrow(
      'HEIC/HEIF',
    );
    expect(decode).not.toHaveBeenCalled();
  });
});
