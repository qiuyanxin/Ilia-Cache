import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { buildPublicFontCatalog } from '../lib/public-font-catalog.mjs';

test('公开字体目录保留来源和官方样张链接，排除本机资料及未知字体文件', async () => {
  const rows = JSON.parse(await readFile(new URL('../public/font-catalog.json', import.meta.url), 'utf8'));
  const publicFonts = buildPublicFontCatalog(rows);
  assert.equal(publicFonts.length, rows.length);
  assert.ok(publicFonts.some(font => font.previewUrl));

  const sample = rows.find(font => font.previewUrl);
  assert.deepEqual(buildPublicFontCatalog([{ ...sample, fontUrl: '/api/assets/private.woff2', note: '私人笔记' }]),
    buildPublicFontCatalog([sample]));
  assert.deepEqual(buildPublicFontCatalog([{ ...sample, sourceUrl: 'http://localhost:4317/private' }]), []);
  assert.equal(buildPublicFontCatalog([{ ...sample, previewUrl: 'https://example.org/fonts.css?family=Ilia' }])[0].previewUrl, undefined);
});
