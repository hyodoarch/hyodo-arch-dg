import { it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { checkAdsTxt, EXPECTED_ADS_TXT } = require('./check-ads-txt.cjs');
const project = fileURLToPath(new URL('../', import.meta.url));
const roots = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    if (path.dirname(path.resolve(root)) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith('dg-ads-txt-')) {
      throw new Error('Unexpected ads.txt fixture path');
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function fixture(source = `${EXPECTED_ADS_TXT}\n`, output = source) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dg-ads-txt-'));
  roots.push(root);
  for (const [file, content] of [['src/site/ads.txt', source], ['dist/ads.txt', output]]) {
    if (content === null) continue;
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  }
  return root;
}

it('keeps the committed source record correct without requiring a prior build', () => {
  const source = fs.readFileSync(path.join(project, 'src/site/ads.txt'));
  expect(() => checkAdsTxt(fixture(source, source))).not.toThrow();
});

it('registers ads.txt in the real Eleventy config for the site root', () => {
  const copies = [];
  const config = new Proxy({ addPassthroughCopy: (value) => copies.push(value) }, {
    get: (target, name) => target[name] || (() => {}),
  });
  const settings = require('../.eleventy.js')(config);
  expect(copies).toContain('src/site/ads.txt');
  expect(settings.dir).toMatchObject({ input: 'src/site', output: 'dist' });
  expect(settings.passthroughFileCopy).not.toBe(false);
}, 30000);

it('retains the automatic postbuild check and manual check command', () => {
  const { scripts } = require('../package.json');
  expect(scripts.postbuild).toBe('node tools/check-ads-txt.cjs');
  expect(scripts['check:ads-txt']).toBe('node tools/check-ads-txt.cjs');
});

it.each(['', '\n', '\r\n'])('accepts an unchanged single record with final newline %j', (ending) => {
  expect(() => checkAdsTxt(fixture(EXPECTED_ADS_TXT + ending))).not.toThrow();
});

it.each([
  ['', 'empty file'],
  [EXPECTED_ADS_TXT.replace('pub-0569052513940110', 'pub-0000000000000000'), 'wrong publisher'],
  [`\ufeff${EXPECTED_ADS_TXT}\n`, 'BOM'],
  [`${EXPECTED_ADS_TXT}\n\n`, 'extra line'],
  [` ${EXPECTED_ADS_TXT}\n`, 'leading space'],
])('rejects incorrect source content even if the output matches: %s (%s)', (source) => {
  expect(() => checkAdsTxt(fixture(source))).toThrow('src/site/ads.txt must contain exactly');
});

it('rejects a missing source', () => {
  expect(() => checkAdsTxt(fixture(null, EXPECTED_ADS_TXT))).toThrow('Cannot read src/site/ads.txt');
});

it('rejects missing output after a build', () => {
  expect(() => checkAdsTxt(fixture(EXPECTED_ADS_TXT, null))).toThrow('Cannot read dist/ads.txt');
});

it('rejects stale or transformed output', () => {
  expect(() => checkAdsTxt(fixture(EXPECTED_ADS_TXT, '<html>404</html>'))).toThrow('byte-for-byte copy');
});
