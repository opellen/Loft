import { describe, it, expect } from 'vitest';
import {
  extForMime,
  mimeForExt,
  deriveFileName,
  findPlaceholderRange,
  pickImageFiles,
  makePlaceholder,
  formatTimestamp,
} from './imageInsertion';

describe('extForMime', () => {
  it('maps known image mimes', () => {
    expect(extForMime('image/png')).toBe('png');
    expect(extForMime('image/jpeg')).toBe('jpg');
    expect(extForMime('image/jpg')).toBe('jpg');
    expect(extForMime('image/gif')).toBe('gif');
    expect(extForMime('image/webp')).toBe('webp');
  });

  it('falls back to the subtype for unknown mimes', () => {
    expect(extForMime('image/bmp')).toBe('bmp');
    expect(extForMime('image/svg+xml')).toBe('svg');
    expect(extForMime('image/avif;codecs=x')).toBe('avif');
  });
});

describe('mimeForExt', () => {
  it('maps known image extensions', () => {
    expect(mimeForExt('png')).toBe('image/png');
    expect(mimeForExt('jpg')).toBe('image/jpeg');
    expect(mimeForExt('jpeg')).toBe('image/jpeg');
    expect(mimeForExt('gif')).toBe('image/gif');
    expect(mimeForExt('webp')).toBe('image/webp');
    expect(mimeForExt('bmp')).toBe('image/bmp');
    expect(mimeForExt('SVG')).toBe('image/svg+xml');
    expect(mimeForExt('avif')).toBe('image/avif');
  });

  it('falls back to octet-stream for unknown extensions', () => {
    expect(mimeForExt('pdf')).toBe('application/octet-stream');
    expect(mimeForExt('')).toBe('application/octet-stream');
  });
});

describe('deriveFileName', () => {
  const fixed = new Date(2026, 6, 1, 9, 8, 7); // 2026-07-01 09:08:07 local

  it('prefixes a meaningful file name with the timestamp', () => {
    expect(deriveFileName('diagram-v2.png', 'image/png', fixed)).toBe(
      '20260701-090807_diagram-v2.png',
    );
  });

  it('trims a meaningful file name before prefixing', () => {
    expect(deriveFileName('  photo.jpg  ', 'image/jpeg', fixed)).toBe(
      '20260701-090807_photo.jpg',
    );
  });

  it('uses the mime for the ext when a meaningful name has none', () => {
    expect(deriveFileName('screenshot', 'image/png', fixed)).toBe(
      '20260701-090807_screenshot.png',
    );
  });

  it('synthesizes a pasted name for a generic image.png', () => {
    expect(deriveFileName('image.png', 'image/png', fixed)).toBe(
      '20260701-090807_pasted.png',
    );
  });

  it('synthesizes a pasted name for an empty file name using mime for ext', () => {
    expect(deriveFileName('', 'image/webp', fixed)).toBe('20260701-090807_pasted.webp');
  });
});

describe('formatTimestamp', () => {
  it('zero-pads all fields', () => {
    expect(formatTimestamp(new Date(2026, 0, 2, 3, 4, 5))).toBe('20260102-030405');
  });
});

describe('findPlaceholderRange', () => {
  const ph = makePlaceholder('u1', 'a.png');

  it('finds the placeholder range', () => {
    const text = `before ${ph} after`;
    const range = findPlaceholderRange(text, ph);
    expect(range).toEqual({ start: 7, end: 7 + ph.length });
    expect(text.slice(range!.start, range!.end)).toBe(ph);
  });

  it('returns null when not found', () => {
    expect(findPlaceholderRange('nothing here', ph)).toBeNull();
  });

  it('picks the first occurrence when a distinct earlier placeholder precedes it', () => {
    const other = makePlaceholder('u0', 'other.png');
    const text = `${other} middle ${ph} end`;
    const range = findPlaceholderRange(text, ph);
    expect(text.slice(range!.start, range!.end)).toBe(ph);
    expect(range!.start).toBe(other.length + ' middle '.length);
  });
});

// Minimal File stub — jsdom's File is unavailable in the default vitest env,
// and pickImageFiles only touches `.type`.
function fakeFile(name: string, type: string): File {
  return { name, type } as unknown as File;
}

// Minimal FileList stub.
function fakeList(files: File[]): FileList {
  return {
    length: files.length,
    item: (i: number) => files[i] ?? null,
  } as unknown as FileList;
}

describe('pickImageFiles', () => {
  it('returns [] for nullish input', () => {
    expect(pickImageFiles(null)).toEqual([]);
    expect(pickImageFiles(undefined)).toEqual([]);
  });

  it('keeps only image/* files', () => {
    const img = fakeFile('a.png', 'image/png');
    const img2 = fakeFile('b.gif', 'image/gif');
    const txt = fakeFile('c.txt', 'text/plain');
    const out = pickImageFiles(fakeList([img, txt, img2]));
    expect(out).toEqual([img, img2]);
  });
});
