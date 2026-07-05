import { describe, it, expect } from 'vitest';
import { findDriveLinks } from './driveEmbeds';

const ID = '1AbC-dEf_GhI';

describe('findDriveLinks', () => {
  it('recognizes an lh3 embed', () => {
    const url = `https://lh3.googleusercontent.com/d/${ID}`;
    const links = findDriveLinks(`![](${url})`);
    expect(links).toHaveLength(1);
    expect(links[0].fileId).toBe(ID);
    expect(links[0].url).toBe(url);
  });

  it('recognizes a thumbnail embed', () => {
    const url = `https://drive.google.com/thumbnail?id=${ID}&sz=w2000`;
    const links = findDriveLinks(`![alt](${url})`);
    expect(links).toHaveLength(1);
    expect(links[0].fileId).toBe(ID);
  });

  it('recognizes an apiMedia embed', () => {
    const url = `https://www.googleapis.com/drive/v3/files/${ID}?alt=media`;
    const links = findDriveLinks(`![](${url})`);
    expect(links).toHaveLength(1);
    expect(links[0].fileId).toBe(ID);
  });

  it('recognizes a uc?id= embed', () => {
    const url = `https://drive.google.com/uc?export=view&id=${ID}`;
    const links = findDriveLinks(`![](${url})`);
    expect(links).toHaveLength(1);
    expect(links[0].fileId).toBe(ID);
  });

  it('recognizes an open?id= embed', () => {
    const url = `https://drive.google.com/open?id=${ID}`;
    const links = findDriveLinks(`![](${url})`);
    expect(links).toHaveLength(1);
    expect(links[0].fileId).toBe(ID);
  });

  it('recognizes a /file/d/<id>/ embed', () => {
    const url = `https://drive.google.com/file/d/${ID}/view`;
    const links = findDriveLinks(`![](${url})`);
    expect(links).toHaveLength(1);
    expect(links[0].fileId).toBe(ID);
  });

  it('strips angle brackets and a title to get the bare url', () => {
    const url = `https://lh3.googleusercontent.com/d/${ID}`;
    const links = findDriveLinks(`![](<${url}> "a title")`);
    expect(links).toHaveLength(1);
    expect(links[0].url).toBe(url);
    expect(links[0].fileId).toBe(ID);
  });

  it('skips a non-Drive markdown embed', () => {
    expect(findDriveLinks('![](https://example.com/x.png)')).toHaveLength(0);
  });

  it('skips a local wikilink embed', () => {
    expect(findDriveLinks('![[a.png]]')).toHaveLength(0);
  });

  it('returns multiple links in ascending offset order with correct offsets', () => {
    const a = `https://lh3.googleusercontent.com/d/${ID}`;
    const b = `https://drive.google.com/uc?id=${ID}`;
    const text = `intro ![](${a}) middle ![alt](${b}) end`;
    const links = findDriveLinks(text);
    expect(links).toHaveLength(2);
    expect(links[0].start).toBeLessThan(links[1].start);
    for (const l of links) {
      expect(text.slice(l.start, l.end)).toBe(l.raw);
    }
    expect(links[0].url).toBe(a);
    expect(links[1].url).toBe(b);
  });
});
