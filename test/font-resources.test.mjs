import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Streamline Flex Solid Free 归入图标网站，不混入字体库', async () => {
  const library = JSON.parse(await readFile(new URL('../data/library.json', import.meta.url), 'utf8'));
  assert.equal(library.customFonts?.some((item) => item.id === 'font-resource-streamline-typeface'), false);
  const row = library.resources.find((item) => item.id === 'website-streamline-flex-solid-free');
  assert.equal(row?.url, 'https://www.streamlinehq.com/icons/flex-solid-free');
  assert.equal(row?.category, '组件');
  assert.match(row?.license || '', /需要署名/);
  assert.equal(library.siteOverrides?.['streamlinehq.com']?.homeUrl, row.url);
  const lineRow = library.resources.find((item) => item.id === 'website-streamline-flex-line-free');
  assert.equal(lineRow?.url, 'https://www.streamlinehq.com/icons/flex-line-free');
  assert.equal(lineRow?.category, '组件');
});
