import { describe, it, expect } from 'vitest';
import { findImageEmbeds, hasImageEmbed } from './imageEmbeds';

describe('findImageEmbeds', () => {
  it('detects a wikilink image embed', () => {
    const text = 'before ![[photo.png]] after';
    const embeds = findImageEmbeds(text);
    expect(embeds).toHaveLength(1);
    expect(embeds[0].kind).toBe('wikilink');
    expect(embeds[0].linkpath).toBe('photo.png');
    expect(text.slice(embeds[0].start, embeds[0].end)).toBe('![[photo.png]]');
  });

  it('detects a markdown image embed', () => {
    const text = 'x ![alt text](images/pic.jpg) y';
    const embeds = findImageEmbeds(text);
    expect(embeds).toHaveLength(1);
    expect(embeds[0].kind).toBe('markdown');
    expect(embeds[0].linkpath).toBe('images/pic.jpg');
    expect(text.slice(embeds[0].start, embeds[0].end)).toBe('![alt text](images/pic.jpg)');
  });

  it('excludes remote http/https/data targets', () => {
    const text =
      '![](http://a.com/x.png) ![](https://b.com/y.jpg) ![](data:image/png;base64,AAAA)';
    expect(findImageEmbeds(text)).toEqual([]);
  });

  it('excludes non-image extensions and note embeds', () => {
    const text = '![[note]] ![[report.pdf]] ![caption](doc.pdf)';
    expect(findImageEmbeds(text)).toEqual([]);
  });

  it('strips wikilink alias and size suffix', () => {
    const text = '![[diagram.png|My diagram|200]]';
    const embeds = findImageEmbeds(text);
    expect(embeds).toHaveLength(1);
    expect(embeds[0].linkpath).toBe('diagram.png');
  });

  it('strips a wikilink heading/subpath fragment', () => {
    const text = '![[folder/img.webp#anchor]]';
    const embeds = findImageEmbeds(text);
    expect(embeds).toHaveLength(1);
    expect(embeds[0].linkpath).toBe('folder/img.webp');
  });

  it('strips a markdown title and query string', () => {
    const text = '![](sub/a.gif?width=10 "a title")';
    const embeds = findImageEmbeds(text);
    expect(embeds).toHaveLength(1);
    expect(embeds[0].linkpath).toBe('sub/a.gif');
  });

  it('URL-decodes an encoded markdown path', () => {
    const text = '![](my%20folder/cool%20pic.png)';
    const embeds = findImageEmbeds(text);
    expect(embeds).toHaveLength(1);
    expect(embeds[0].linkpath).toBe('my folder/cool pic.png');
  });

  it('returns multiple embeds in ascending start order with correct offsets', () => {
    const text = 'A ![](one.png) B ![[two.jpeg]] C ![](three.webp) D';
    const embeds = findImageEmbeds(text);
    expect(embeds.map((e) => e.linkpath)).toEqual(['one.png', 'two.jpeg', 'three.webp']);
    for (const e of embeds) {
      expect(text.slice(e.start, e.end)).toBe(e.raw);
    }
    // Strictly ascending starts.
    for (let i = 1; i < embeds.length; i++) {
      expect(embeds[i].start).toBeGreaterThan(embeds[i - 1].start);
    }
  });

  it('keeps a wikilink and a remote markdown apart, dropping only the remote', () => {
    const text = '![[local.png]] and ![](https://x/y.png)';
    const embeds = findImageEmbeds(text);
    expect(embeds.map((e) => e.linkpath)).toEqual(['local.png']);
  });
});

describe('hasImageEmbed', () => {
  it('is true for a wikilink local image embed', () => {
    expect(hasImageEmbed('before ![[photo.png]] after')).toBe(true);
  });

  it('is true for a markdown local image embed', () => {
    expect(hasImageEmbed('x ![alt text](images/pic.jpg) y')).toBe(true);
  });

  it('is false for empty text', () => {
    expect(hasImageEmbed('')).toBe(false);
  });

  it('is false when only remote targets are present', () => {
    const text =
      '![](http://a.com/x.png) ![](https://b.com/y.jpg) ![](data:image/png;base64,AAAA)';
    expect(hasImageEmbed(text)).toBe(false);
  });

  it('is false for non-image extensions and note embeds', () => {
    expect(hasImageEmbed('![[note]] ![[report.pdf]] ![caption](doc.pdf)')).toBe(false);
  });

  it('agrees with findImageEmbeds(...).length > 0 on a mixed sample', () => {
    const samples = [
      '',
      'plain text with no embeds',
      '![[note]] ![[report.pdf]]',
      '![](http://a.com/x.png)',
      'A ![](one.png) B ![[two.jpeg]] C',
      'lead ![[local.png]] and ![](https://x/y.png) trail',
    ];
    for (const text of samples) {
      expect(hasImageEmbed(text)).toBe(findImageEmbeds(text).length > 0);
    }
  });
});
