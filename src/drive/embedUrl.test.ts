import { describe, it, expect } from 'vitest';
import { buildEmbedUrl, parseFileId } from './embedUrl';
import type { EmbedFormat } from './types';

const ID = '1AbC-dEf_GhI';

describe('buildEmbedUrl', () => {
  it('builds an lh3 URL', () => {
    expect(buildEmbedUrl(ID, 'lh3')).toBe(`https://lh3.googleusercontent.com/d/${ID}`);
  });

  it('builds a thumbnail URL with sz param', () => {
    expect(buildEmbedUrl(ID, 'thumbnail')).toBe(
      `https://drive.google.com/thumbnail?id=${ID}&sz=w2000`,
    );
  });

  it('builds an apiMedia URL with alt=media', () => {
    expect(buildEmbedUrl(ID, 'apiMedia')).toBe(
      `https://www.googleapis.com/drive/v3/files/${ID}?alt=media`,
    );
  });
});

describe('parseFileId round-trip', () => {
  const formats: EmbedFormat[] = ['lh3', 'thumbnail', 'apiMedia'];
  for (const format of formats) {
    it(`recovers the id from a ${format} URL`, () => {
      const url = buildEmbedUrl(ID, format);
      expect(parseFileId(url)).toBe(ID);
    });
  }

  it('returns null for an unrelated URL', () => {
    expect(parseFileId('https://example.com/not-a-drive-link')).toBeNull();
  });
});

describe('parseFileId recovery of legacy/external Drive URLs', () => {
  it('recovers the id from a uc URL with id first', () => {
    expect(parseFileId(`https://drive.google.com/uc?id=${ID}`)).toBe(ID);
  });

  it('recovers the id from a uc URL with export param before id', () => {
    expect(parseFileId(`https://drive.google.com/uc?export=view&id=${ID}`)).toBe(ID);
  });

  it('recovers the id from a uc URL with a param after id', () => {
    expect(parseFileId(`https://drive.google.com/uc?id=${ID}&export=download`)).toBe(ID);
  });

  it('recovers the id from an open?id= URL', () => {
    expect(parseFileId(`https://drive.google.com/open?id=${ID}`)).toBe(ID);
  });

  it('recovers the id from a /file/d/<id>/ URL with trailing slash', () => {
    expect(parseFileId(`https://drive.google.com/file/d/${ID}/view?usp=sharing`)).toBe(ID);
  });

  it('recovers the id from a /file/d/<id> URL without trailing slash', () => {
    expect(parseFileId(`https://drive.google.com/file/d/${ID}`)).toBe(ID);
  });

  it('still returns null for a non-Drive URL', () => {
    expect(parseFileId('https://example.com/uc?id=nope')).toBeNull();
  });
});
