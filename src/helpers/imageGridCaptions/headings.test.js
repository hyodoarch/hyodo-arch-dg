import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import MarkdownIt from 'markdown-it';
import { parse } from 'node-html-parser';
const require = createRequire(import.meta.url);
const { imageGridCaptions } = require('./index');
const { parseCaption, parseGrid } = require('./shared/parser');
const md = new MarkdownIt().use(imageGridCaptions);
const image = 'images/top/yamate_IGP0510a.jpg';
const render = caption => parse(md.render('```image-grid-captions\ncolumns: 2\n' +
  `![[${image}|${caption}]]\n![[${image}]]\n` + '```'));

describe('Grid caption headings', () => {
  it.each([['## 店舗入口', 2, '店舗入口'], ['### 材料と仕上げ', 3, '材料と仕上げ']])('renders %s as a semantic heading', (source, level, text) => {
    const html = render(source);
    expect(html.querySelector(`figcaption h${level}`).text).toBe(text);
    expect(html.querySelector('img').getAttribute('alt')).toBe(text);
    expect(html.querySelectorAll('figcaption')).toHaveLength(1);
    expect(html.querySelectorAll('.image-captions-figure')).toHaveLength(0);
  });
  it.each(['# H1', '#### H4', '##空白なし', '本文 ## 記号', '##', '###'])('keeps unsupported or incomplete prefix literal: %s', caption => {
    const html = render(caption);
    expect(html.querySelector('figcaption').text).toBe(caption);
    expect(html.querySelector('figcaption').children).toHaveLength(0);
  });
  it.each(['##', '###'])('allows escaping %s', marker => {
    const html = render(`\\${marker} 文字`);
    expect(html.querySelector('figcaption').text).toBe(`${marker} 文字`);
    expect(html.querySelector('figcaption').children).toHaveLength(0);
    expect(html.querySelector('img').getAttribute('alt')).toBe(`${marker} 文字`);
  });
  it('never interprets HTML or inline Markdown within headings', () => {
    const text = '**bold** <script>alert(1)</script> <img src=x onerror=alert(1)> & "quote" #tag';
    const html = render(`## ${text}`);
    expect(html.querySelector('h2').text).toBe(text);
    expect(html.querySelector('h2').children).toHaveLength(0);
    expect(html.querySelectorAll('img')).toHaveLength(2);
    expect(html.querySelector('script')).toBeNull();
  });
  it('parses tab separators and leaves the original caption available', () => {
    expect(parseCaption('###\t見出し')).toEqual({ text: '見出し', headingLevel: 3 });
    expect(parseGrid('columns: 2\n![[a.jpg|## 外観]]\n![[b.jpg]]').images[0])
      .toEqual({ path: 'a.jpg', caption: '## 外観', alt: '外観' });
  });
  it('renders multiline headings and separate paragraphs inside one figcaption', () => {
    const html = render('## 店舗入口\n入口の説明です。\n\n### 材料\n杉板を使っています。\n二行目も同じ段落です。\n\n<em>文字</em> #tag');
    const caption = html.querySelector('figcaption');
    expect(caption.children.map(el => el.tagName)).toEqual(['H2', 'P', 'H3', 'P', 'P']);
    expect(caption.querySelectorAll('p')[1].text).toBe('杉板を使っています。\n二行目も同じ段落です。');
    expect(caption.querySelector('em')).toBeNull();
    expect(html.querySelector('img').getAttribute('alt')).not.toContain('##');
    expect(html.querySelectorAll('figcaption')).toHaveLength(1);
  });
  it.each(['![[a.jpg|\n## 閉じ忘れ', '![[a.jpg|\n本文\n![[b.jpg]]', '![[a.jpg\n]]\n![[b.jpg]]'])('isolates malformed multiline caption: %s', source => {
    const html = md.render('```image-grid-captions\ncolumns: 2\n' + source + '\n```\n\n後続本文');
    expect(html).toContain('role="alert"');
    expect(html).toContain('<p>後続本文</p>');
  });
});
