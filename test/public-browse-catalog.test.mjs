import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildPublicBrowseCatalog } from '../lib/public-browse-catalog.mjs';
import { filterWebsites } from '../public/website-library-view.mjs';

async function publicJson(name) {
  return JSON.parse(await readFile(new URL(`../public/${name}.json`, import.meta.url), 'utf8'));
}

test('公开网站归并域名、保留具体链接和已审核的策展信息', async () => {
  const [seed, summaries] = await Promise.all([publicJson('seed'), publicJson('site-summaries')]);
  const { websites } = buildPublicBrowseCatalog(seed, summaries);
  assert.equal(websites.length, 90);
  assert.equal(websites.flatMap(site => site.links).length, 109);
  const reactBits = websites.find(site => site.id === 'site:reactbits.dev');
  assert.equal(reactBits.title, 'React Bits');
  assert.ok(reactBits.links.some(link => link.url === 'https://reactbits.dev/tools/center-stage'));
  const motionPrompt = websites.find(site => site.id === 'site:showheyohtaki.github.io');
  assert.equal(motionPrompt.url, 'https://showheyohtaki.github.io/motion-prompt/');
  assert.equal(motionPrompt.finds, summaries[motionPrompt.domain].finds);
  assert.equal(motionPrompt.verification.checkedAt, '2026-11-21');
  assert.ok(filterWebsites(websites, { filter: '有收藏' }).includes(motionPrompt));
  const blocked = websites.find(site => site.id === 'site:museumdepartment.com');
  assert.match(blocked.verification.note, /原站访问受限/);
});

test('公开页面来自种子，保留具体出处与参考文案性质', async () => {
  const [seed, summaries] = await Promise.all([publicJson('seed'), publicJson('site-summaries')]);
  const { pages } = buildPublicBrowseCatalog(seed, summaries);
  assert.equal(pages.length, 280);
  assert.equal(pages.filter(row => row.promptKind === 'original').length, 3);
  assert.equal(pages.filter(row => row.promptKind === 'implementation-task').length, 277);
  const carousel = pages.find(row => row.id === 'page-ms-outfit-carousel');
  assert.equal(carousel.title, 'Outfit Carousel');
  assert.equal(carousel.sourcePageUrl, 'https://motionsites.ai/?prompt=outfit-carousel');
  assert.equal(carousel.sourcePageKind, 'primary');
  assert.equal(carousel.sourceAuthor, 'MotionSites');
  assert.ok(pages.every(row => !('prompt' in row) && !('preview' in row) && !('files' in row)));
  assert.ok(!pages.some(row => row.id === 'page-ms-ai-image-generator-ui'));
});

test('网站和页面仅投影已发布字段，本机范围与私人字段不进入结果', () => {
  const privateFields = {
    archived: false,
    note: 'private-marker',
    source: 'private-marker',
    prompt: 'private-marker',
    originalPrompt: 'private-marker',
    favorite: true,
    media: [{ type: 'image', url: 'https://screens.dev/private-marker.png' }],
    preview: 'https://screens.dev/private-marker.png',
    localPoster: '/api/assets/private-marker.jpg',
    files: [{ name: 'private-marker.json', content: 'private-marker' }],
    usage: [{ project: 'private-marker' }],
  };
  const seed = [
    { ...privateFields, id: 'home', kind: '网站', url: 'https://gallery.dev/', name: 'Gallery', created: '2026-11-22T09:00:00.000Z' },
    { ...privateFields, id: 'doc', kind: '网站', url: 'https://www.gallery.dev/doc', name: '文档', created: 'private-marker' },
    { ...privateFields, id: 'page', caseType: '网页参考', url: 'https://source.dev/demo', name: '演示', promptKind: 'user-edited' },
    { id: 'private-ip', kind: '网站', url: 'http://127.0.0.1:4317/' },
    { id: 'private-host', kind: '网站', url: 'http://nas.internal/' },
    { id: 'private-token', caseType: '网页参考', url: 'https://user:secret@source.dev/demo', name: '账号' },
    { id: 'reference-file', kind: '网站', url: 'file:///private/tmp/state.json' },
    { id: 'component', kind: '网站', url: 'https://gallery.dev/component', componentCategory: '按钮' },
    { id: 'archived', kind: '网站', url: 'https://archived.dev/', archived: true },
  ];
  const summaries = {
    'gallery.dev': {
      name: '策展名称', homeUrl: 'http://localhost:4317/', sourceUrl: 'file:///private/tmp/a',
      description: '已发布简介', siteOverride: 'private-marker',
    },
  };
  const before = structuredClone(seed);
  const catalog = buildPublicBrowseCatalog(seed, summaries);
  assert.deepEqual(seed, before);
  assert.equal(catalog.websites.length, 1);
  assert.equal(catalog.websites[0].title, '策展名称');
  assert.equal(catalog.websites[0].url, 'https://gallery.dev/');
  assert.equal(catalog.websites[0].verification, null);
  assert.equal(catalog.websites[0].created, '2026-11-22');
  assert.deepEqual(catalog.websites[0].links.map(row => row.id), ['home', 'doc']);
  assert.equal(catalog.pages.length, 1);
  assert.equal(catalog.pages[0].promptKind, null);
  assert.equal(catalog.pages[0].sourcePageKind, 'unresolved');
  assert.equal(catalog.pages[0].sourcePageUrl, 'https://source.dev/demo');
  assert.doesNotMatch(JSON.stringify(catalog), /private-marker/);
});

test('网站最新添加排序使用公开添加日期，日期缺失与无效记录按目录原序', () => {
  const { websites } = buildPublicBrowseCatalog([
    { id: 'bad-date', kind: '网站', url: 'https://a.dev/', created: 'private-marker' },
    { id: 'not-dated', kind: '网站', url: 'https://b.dev/' },
    { id: 'older', kind: '网站', url: 'https://c.dev/', created: '2026-11-20T01:00:00.000Z' },
    { id: 'newer', kind: '网站', url: 'https://d.dev/', created: '2026-11-22' },
  ], {});
  assert.deepEqual(filterWebsites(websites, { order: 'new' }).map(({ domain, created }) => [domain, created]), [
    ['d.dev', '2026-11-22'],
    ['c.dev', '2026-11-20'],
    ['a.dev', ''],
    ['b.dev', ''],
  ]);
});

test('未确认第一来源的页面保留已记录的收录出处', () => {
  const { pages } = buildPublicBrowseCatalog([{
    id: 'linked-page', name: '参考页', caseType: '网页参考', url: 'https://gallery.dev/card',
    sourcePageUrl: 'https://collection.dev/archive/example', sourcePageKind: 'collection',
    sourceLinkAvailable: false, primarySourceKind: 'original', primarySourceUrl: 'https://source.dev/unknown',
    primarySourceAuthor: '已知作者', collectionSource: { name: '案例目录' },
    promptKind: 'implementation-task', prompt: '用于实现参考页的提示词',
  }], {});
  assert.equal(pages[0].sourcePageUrl, 'https://collection.dev/archive/example');
  assert.equal(pages[0].sourcePageKind, 'collection');
  assert.equal(pages[0].sourceAuthor, '已知作者');
  assert.equal(pages[0].collectionSource, '案例目录');
  assert.equal(pages[0].promptKind, 'implementation-task');
  assert.ok(!('prompt' in pages[0]));
});
