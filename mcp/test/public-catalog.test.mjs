import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildPublicCatalog } from '../../lib/public-catalog.mjs';
import { selectComponentRecords } from '../../public/component-directory.mjs';
import { createCatalog, createPublicCatalog } from '../catalog.mjs';

const baseline = {
  id: 'demo', name: 'Demo UI', sourcePolicy: 'source-link-only', sourcePageUrl: 'https://public.example.org/components/demo',
};

test('本机 MCP 为已公开组件返回私人素材，同时保留 Ilia 官网详情链接', async t => {
  const dataDir = await mkdtemp(join(tmpdir(), 'ilia-reference-mcp-'));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const id = 'reactbits-squish-switch';
  const baseUrl = 'https://ilia.example.com';
  const previewBaseUrl = 'http://127.0.0.1:4317';
  const referencePreview = {
    kind: 'video', url: '/api/assets/abcd.webm', poster: '/api/assets/abcd.png',
    sourcePageUrl: 'https://example.org/components/example', width: 360, height: 640, duration: 4,
    label: '手机截图', provenance: '原始演示',
  };
  await writeFile(join(dataDir, 'library.json'), JSON.stringify({
    resources: [{ id, caseType: '组件', referencePreview }],
  }));
  const local = createCatalog({ dataDir, baseUrl, previewBaseUrl });
  const publicCatalog = createPublicCatalog({ baseUrl });
  assert.equal((await local.record('component', id)).summary.referencePreview, undefined);
  const { summary } = await local.record('component', id, { includeLocalReference: true });
  assert.equal(summary.detailUrl, baseUrl + '/components/' + id);
  assert.deepEqual(summary.referencePreview, {
    ...referencePreview, url: previewBaseUrl + referencePreview.url, poster: previewBaseUrl + referencePreview.poster,
  });
  assert.equal((await publicCatalog.record('component', id, { includeLocalReference: true })).summary.referencePreview, undefined);
});

test('公开目录只投影明确发布字段，拒绝个人素材及不具体的来源页', () => {
  const { components } = buildPublicCatalog([
    {
      ...baseline,
      note: 'personal note',
      usage: [{ project: 'private-project' }],
      favorite: true,
      files: [{ name: 'secret.js', content: 'PRIVATE_BYTES' }],
      filePackage: 'private-package',
      media: [{ type: 'image', url: '/api/assets/private.png' }],
      previewCandidates: [{ url: '/api/assets/private.png' }],
      referencePreview: { url: '/api/assets/private.png' },
      externalPreview: 'https://localhost/private',
      localPoster: '/api/assets/private.png',
    },
    { ...baseline, id: 'homepage', sourcePageUrl: 'https://public.example.org' },
    { ...baseline, id: 'archived', archived: true },
    { ...baseline, id: 'unreviewed', sourcePolicy: undefined },
    { ...baseline, id: 'local-source', sourcePageUrl: 'http://127.0.0.1:4317/components/private' },
    { ...baseline, id: 'invalid path' },
    { ...baseline, id: 'claimed', sourcePolicy: 'bundled-source', license: 'MIT', filePackage: 'claimed' },
  ]);
  assert.deepEqual(components.map(({ id }) => id), ['demo', 'claimed']);
  assert.equal(components[0].path, '/components/demo');
  assert.equal(components[0].preview.url, baseline.sourcePageUrl);
  assert.equal(components[1].sourcePolicy, 'source-link-only');
  assert.deepEqual(components[1].files, []);
  assert.doesNotMatch(JSON.stringify(components), /private|personal|favorite|PRIVATE_BYTES/);
});

test('线上目录与公开 MCP 共享同一 ID、预览和来源，受限源码拒绝读取', async () => {
  const seed = JSON.parse(await readFile(new URL('../../public/seed.json', import.meta.url)));
  const { components } = buildPublicCatalog(seed);
  const mcp = createPublicCatalog({ baseUrl: 'https://ilia.example.com' });
  const bundled = components.find(row => row.id === 'motion-prompt-059');
  const restricted = components.find(row => row.id === 'reactbits-squish-switch');
  assert.equal(bundled.preview.kind, 'html');
  assert.equal(bundled.preview.url, '/motion-prompt-preview/index.html?pack=ui&id=059');
  assert.ok(bundled.files.includes('LICENSE'));
  assert.equal(restricted.preview.kind, 'video');
  assert.deepEqual(restricted.files, []);
  const sound = components.find(row => row.id === 'reactbits-sound-pebble');
  assert.match(seed.find(row => row.id === sound.id).description, /点击卡片试听/);
  assert.match(sound.description, /可在原站试听/);
  assert.equal((await mcp.record('component', sound.id)).record.description, sound.description);
  const { record, summary } = await mcp.record('component', bundled.id);
  assert.equal(record.id, bundled.id);
  assert.equal(record.sourcePolicy, bundled.sourcePolicy);
  assert.equal(record.sourcePageUrl, undefined);
  assert.equal(record.prompt, undefined);
  assert.equal(summary.detailUrl, 'https://ilia.example.com' + bundled.path);
  assert.deepEqual(summary.preview, { kind: 'website_url', url: summary.detailUrl });
  assert.deepEqual(record.preview, summary.preview);
  assert.equal(summary.upstreamUrl, null);
  assert.doesNotMatch(JSON.stringify(record), /showheyohtaki\.github\.io/);
  assert.match(await mcp.file(bundled.id, 'LICENSE'), /MIT License/);
  assert.match(await mcp.file(bundled.id, 'ORIGIN.json'), /showheyohtaki\.github\.io/);
  await assert.rejects(mcp.file(restricted.id, 'secrets.tsx'), /source_restricted.*https:\/\/ilia\.example\.com\/components\/reactbits-squish-switch/);
  assert.equal((await mcp.overview()).counts.component, components.length);
  for (const component of components) {
    const { record, summary } = await mcp.record('component', component.id);
    const returnedLinks = JSON.stringify({ record, summary }).match(/https?:\/\/[^"\s]+/gu);
    assert.deepEqual(new Set(returnedLinks), new Set([summary.detailUrl]), component.id);
  }
});

test('公开组件界面和 MCP 使用相同的检索字段、词语和结果顺序', async () => {
  const seed = JSON.parse(await readFile(new URL('../../public/seed.json', import.meta.url)));
  const { components } = buildPublicCatalog(seed);
  const rows = components.map(record => ({
    ...record, name: record.title, componentCategory: record.category,
    sourceShort: record.sourceName, url: record.sourcePageUrl,
  }));
  const mcp = createPublicCatalog({ baseUrl: 'https://ilia.example.com' });
  const searches = [
    { query: 'motion-prompt-059', first: 'motion-prompt-059' },
    { query: 'ＳｑｕｉｓｈＳｗｉｔｃｈ', first: 'reactbits-squish-switch' },
    { query: 'React Bits SquishSwitch', first: 'reactbits-squish-switch' },
    { query: '略微超出目标尺寸后回弹', first: 'motion-prompt-001' },
    { query: 'entrances-text', total: 8 },
    { query: 'David Haz', total: 420 },
    { query: 'image carousel', total: 21 },
    { query: '图片轮播', total: 21 },
    { query: '全屏的图像轮播有哪些组件？', total: 0 },
    { query: '元素弹跳着出现', total: 0 },
    { query: 'collectionSource', total: 0 },
    { source: 'Bencho', category: '图集与轮播', total: 2 },
  ];
  for (const { total, first, ...filters } of searches) {
    const browser = selectComponentRecords(rows, { ...filters, readonly: true });
    const result = await mcp.search({ ...filters, kind: 'component', offset: 0, limit: 850 });
    const actual = result.items.map(({ id }) => id);
    assert.deepEqual(actual, browser.map(({ id }) => id), JSON.stringify(filters));
    if (total !== undefined) assert.equal(actual.length, total, JSON.stringify(filters));
    if (first) assert.equal(actual[0], first, JSON.stringify(filters));
    assert.ok(result.items.every(({ detailUrl, upstreamUrl }) => detailUrl.startsWith('https://ilia.example.com/components/') && upstreamUrl === null));
  }
  assert.deepEqual(selectComponentRecords(seed, { query: '元素弹跳着出现' }).map(record => record.id), ['motion-prompt-001']);
});
