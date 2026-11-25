import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sitePreviewRank } from '../public/catalog.mjs';

const readLibrary = async () => JSON.parse(await readFile(new URL('../data/library.json', import.meta.url), 'utf8'));

test('开源 Dashboard 页面都有预览、源码、许可和来源边界', async () => {
  const library = await readLibrary();
  const rows = library.resources.filter((item) => String(item.id).startsWith('page-dashboard-open-'));
  assert.equal(rows.length, 6);
  assert.ok(rows.every((item) => item.pageCategory === 'Dashboard'));
  assert.ok(rows.every((item) => item.livePreview && item.primarySourceUrl.startsWith('https://github.com/')));
  assert.ok(rows.every((item) => item.license && item.sourcePolicy === 'source-link-only'));
});

test('Logo 网站有明确许可提醒，预览排序把 100font 放到最后', async () => {
  const library = await readLibrary();
  const rows = library.resources.filter((item) => String(item.id).startsWith('website-open-logo-'));
  assert.equal(rows.length, 6);
  assert.ok(rows.every((item) => item.primarySourceUrl && item.license && item.sourcePolicy === 'source-link-only'));
  const sorted = [
    { domain: 'unknown.example' },
    { domain: 'blocked.example', previewable: false },
    { domain: '100font.com', previewable: true },
    { domain: 'works.example', previewable: true },
  ].sort((a, b) => sitePreviewRank(a) - sitePreviewRank(b));
  assert.deepEqual(sorted.map((item) => item.domain), ['works.example', 'unknown.example', 'blocked.example', '100font.com']);
});
