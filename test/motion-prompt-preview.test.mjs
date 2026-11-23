import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildPublicCatalog } from '../lib/public-catalog.mjs';
import { isMotionPromptRecord, motionPreviewForRecord } from '../public/motion-prompt-preview/index.mjs';

const publicRoot = new URL('../public/', import.meta.url);
const rows = JSON.parse(await readFile(new URL('seed.json', publicRoot), 'utf8'));
const catalog = buildPublicCatalog(rows);

test('每个可播放的 Motion Prompt 组件都有独立 WebP 和本地运行文件', async () => {
  const source = rows.filter(isMotionPromptRecord);
  assert.equal(source.length, 240);
  const previews = source.map(motionPreviewForRecord).filter(Boolean);
  assert.equal(previews.length, 216);
  const digests = new Set();
  for (const preview of previews) {
    const url = new URL(preview.url, 'https://ilia.example.com');
    const id = url.searchParams.get('id');
    assert.equal(preview.poster, '/motion-prompt-preview/posters/' + id + '.webp');
    const poster = await readFile(new URL(preview.poster.slice(1), publicRoot));
    assert.equal(poster.toString('ascii', 0, 4), 'RIFF');
    assert.equal(poster.toString('ascii', 8, 12), 'WEBP');
    digests.add(createHash('sha256').update(poster).digest('hex'));
    await access(new URL('motion-prompt-preview/packs/' + url.searchParams.get('pack') + '/pack.js', publicRoot));
    const record = catalog.components.find(entry => entry.id === 'motion-prompt-' + id);
    assert.deepEqual(record.preview, preview);
  }
  assert.equal(digests.size, previews.length, '每个组件使用实际帧');
});

test('有独立图片的画风包使用官方静态样例，来源或许可不符的输入不会生成预览', () => {
  const artstyle = rows.find(record => record.id === 'motion-prompt-193');
  assert.equal(isMotionPromptRecord(artstyle), true);
  assert.equal(motionPreviewForRecord(artstyle), null);
  assert.deepEqual(catalog.components.find(entry => entry.id === artstyle.id).preview, {
    kind: 'image', url: 'https://showheyohtaki.github.io/motion-prompt/packs/artstyle/img/style-01.webp', ratio: 1078 / 416,
  });
  const ordinary = rows.find(record => record.id === 'motion-prompt-059');
  const preview = motionPreviewForRecord(ordinary);
  const assetPrefix = '/ilia-ui/releases/example';
  assert.deepEqual(motionPreviewForRecord(ordinary, { assetPrefix }), {
    ...preview, url: assetPrefix + preview.url, poster: assetPrefix + preview.poster,
  });
  assert.equal(motionPreviewForRecord({ ...ordinary, license: 'unknown' }), null);
  assert.equal(motionPreviewForRecord({ ...ordinary, sourcePolicy: 'source-link-only' }), null);
  assert.equal(isMotionPromptRecord({ ...ordinary, sourcePageUrl: 'https://example.org/#059' }), false);
});
