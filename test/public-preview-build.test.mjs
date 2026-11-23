import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildPublicPreviews } from '../scripts/build-public-previews.mjs';

test('公开预览写入自包含 React 示例，保留目录内其他预览', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ilia-preview-build-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const existing = path.join(directory, 'existing-preview.html');
  await writeFile(existing, '已有预览', 'utf8');

  const output = await buildPublicPreviews(directory);
  assert.equal(output, path.join(directory, 'ilia-preview-counter.html'));
  const html = await readFile(output, 'utf8');
  assert.match(html, /<div id="preview"><\/div><script>/);
  assert.match(html, /\.bg-slate-900/);
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc=|<link\b[^>]*\bhref=/i);
  assert.equal(await readFile(existing, 'utf8'), '已有预览');
});
