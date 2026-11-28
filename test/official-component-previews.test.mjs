import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildPublicCatalog } from '../lib/public-catalog.mjs';
import { officialPreviewForRecord, officialSourceForRecord, transitionDemoForRecord } from '../public/official-component-previews.mjs';

const seed = JSON.parse(await readFile(new URL('../public/seed.json', import.meta.url), 'utf8'));
const byId = new Map(seed.map(row => [row.id, row]));
const catalog = new Map(buildPublicCatalog(seed).components.map(row => [row.id, row]));

test('官方图片和独立预览帧在原始记录与公开目录使用相同的精确地址', () => {
  const approved = seed.filter(officialPreviewForRecord);
  const previews = approved.map(officialPreviewForRecord);
  assert.equal(previews.filter(item => item.kind === 'image').length, 71);
  assert.equal(previews.filter(item => item.kind === 'html').length, 206);
  assert.equal(previews.filter(item => item.kind === 'video').length, 14);
  assert.equal(new Set(previews.map(item => item.url)).size, previews.length);
  for (const row of approved) {
    const publicRow = catalog.get(row.id);
    assert.deepEqual(officialPreviewForRecord(publicRow), publicRow.preview, row.id);
    assert.deepEqual(officialPreviewForRecord(row), publicRow.preview, row.id);
  }

  assert.deepEqual(catalog.get('reactbits-shape-grid').preview, {
    kind: 'image', ratio: 1200 / 630, url: 'https://reactbits.dev/og/backgrounds/shape-grid.jpg',
  });
  assert.deepEqual(catalog.get('designbookmark-exposure-slider').preview, {
    kind: 'html', url: 'https://smoothui.dev/preview/exposure-slider?embed=1',
  });
});

test('网址和组件记录必须吻合，沙箱中不可用的原站预览继续指向来源', () => {
  const exposure = byId.get('designbookmark-exposure-slider');
  assert.equal(officialPreviewForRecord({...exposure, sourcePageUrl: 'https://smoothui.dev/docs/components/scrubber'}), null);
  assert.equal(officialPreviewForRecord({...exposure, sourcePageUrl: 'https://smoothui.dev.example.org/docs/components/exposure-slider'}), null);
  assert.equal(officialPreviewForRecord({...exposure, id: 'arbitrary'}), null);

  const art = byId.get('motion-prompt-193');
  assert.equal(officialPreviewForRecord({...art, license: 'unknown'}), null);
  assert.equal(officialPreviewForRecord({...art, sourcePageUrl: 'https://showheyohtaki.github.io/motion-prompt/#194'}), null);

  const siri = byId.get('designbookmark-siri-orb');
  assert.equal(officialPreviewForRecord(siri), null);
  assert.deepEqual(catalog.get(siri.id).preview, {kind: 'external', url: siri.sourcePageUrl});
});

test('逐音色入口使用原站分享链接，音色在公开目录使用原站播放器', () => {
  const lab = 'https://reactbits.dev/tools/sound-lab';
  const engine = byId.get('reactbits-sound-engine');
  const sounds = seed.filter(row => row.sourcePageUrl === lab && row !== engine);
  assert.equal(sounds.length, 200);
  for (const sound of sounds) {
    const url = lab + '#sound=' + sound.id.slice('reactbits-sound-'.length);
    const projected = catalog.get(sound.id);
    assert.equal(officialSourceForRecord(sound), url, sound.id);
    assert.equal(officialSourceForRecord(projected), url, sound.id);
    assert.equal(projected.sourcePageUrl, url, sound.id);
    assert.deepEqual(projected.preview, {kind: 'html', url}, sound.id);
    assert.deepEqual(officialPreviewForRecord(sound), {kind: 'html', url}, sound.id);
    assert.equal('soundRecipe' in projected, false, sound.id);
  }
  assert.equal(officialSourceForRecord(engine), null);
  assert.deepEqual(catalog.get(engine.id).preview, {kind: 'html', url: lab});

  const pebble = byId.get('reactbits-sound-pebble');
  assert.equal(officialSourceForRecord({...pebble, sourcePageUrl: lab + '#sound=halo'}), null);
  assert.equal(officialSourceForRecord({...pebble, sourcePageUrl: 'https://reactbits.dev.example.org/tools/sound-lab'}), null);
  assert.equal(officialSourceForRecord({...pebble, id: 'reactbits-sound-unreviewed'}), null);
  assert.equal(officialSourceForRecord({...pebble, sourceShort: 'Another source'}), null);
});


test('点阵加载的旧链接定位到当前组件，也保留点阵专用封面', () => {
  const row = byId.get('transitions-matrix-loader');
  const current = 'https://transitions.dev/detail.html?t=matrix-dot-loader';
  const legacy = { ...row, sourcePageUrl: 'https://transitions.dev/detail.html?t=matrix-loader' };
  assert.equal(transitionDemoForRecord(row), current);
  assert.equal(officialSourceForRecord(legacy), current);
  assert.equal(officialPreviewForRecord(legacy).url, '/component-posters/transitions-matrix-loader.jpg');
  assert.equal(transitionDemoForRecord({ ...row, sourcePageUrl: 'https://transitions.dev/detail.html?t=card-resize' }), null);
});
