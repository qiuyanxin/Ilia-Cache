import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const entry = fileURLToPath(new URL('../server.mjs', import.meta.url));
const previewOrigin = 'http://127.0.0.1:4399';
const fixtureId = '影像/轮播 #1';
const assetId = 'b4c7.png';
const sourceText = '// 甲📷乙\nexport const slides = [1, 2];';
const writeJson = (target, data) => writeFile(target, JSON.stringify(data) + '\n');

async function setup(t, env = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'ilia-cache-mcp-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const client = new Client({ name: 'ilia-cache-smoke', version: '0.1.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [entry],
    cwd: dir,
    env: { ILIACACHE_DATA_DIR: dir, ILIACACHE_PREVIEW_BASE_URL: previewOrigin, ...env },
  });
  await client.connect(transport);
  t.after(() => client.close());
  return { dir, client };
}

async function call(client, name, args = {}) {
  const result = await client.callTool({ name: 'ilia_cache_' + name, arguments: args });
  assert.equal(Boolean(result.isError), false, JSON.stringify(result.content));
  assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
  return result.structuredContent;
}

test('公开种子通过 stdio 暴露工具、资源和各类记录，组件搜索不会把网页参考当作轮播组件', async t => {
  const { dir, client } = await setup(t);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(tool => tool.name), [
    'search_resources', 'get_resource', 'read_resource_file',
    'ilia_cache_search_components', 'ilia_cache_search_library',
    'ilia_cache_get_record', 'ilia_cache_read_component_file', 'ilia_cache_get_component_handoff',
  ]);
  for (const tool of tools) {
    assert.equal(tool.annotations.readOnlyHint, true);
    assert.equal(tool.annotations.openWorldHint, false);
    assert.ok(tool.outputSchema);
  }
  const { resources } = await client.listResources();
  assert.equal(resources[0].uri, 'ilia-cache://catalog');
  const { resourceTemplates } = await client.listResourceTemplates();
  assert.equal(resourceTemplates[0].uriTemplate, 'ilia-cache://records/{kind}/id-{id}');
  const overview = JSON.parse((await client.readResource({ uri: resources[0].uri })).contents[0].text);
  assert.equal(overview.mode, 'public_seed');
  assert.ok(overview.counts.website > 0 && overview.counts.style > 0 && overview.counts.font > 0);

  const exact = await call(client, 'search_components', { query: '全屏的图像轮播有哪些组件？' });
  assert.equal(exact.mode, 'public_seed');
  assert.deepEqual(exact.items, []);

  const pages = await call(client, 'search_library', { kind: 'page', query: 'Outfit Carousel' });
  const outfit = pages.items.find(item => item.id === 'page-ms-outfit-carousel');
  assert.equal(outfit?.preview.url, previewOrigin + '/#/pages/page-ms-outfit-carousel');
  const details = await call(client, 'get_record', { kind: 'component', id: 'builtin-swipe-deck' });
  assert.equal(details.summary.preview.url, 'http://127.0.0.1:4318/components/builtin-swipe-deck');
  assert.ok(details.files.includes('index.html'));
  const file = await call(client, 'read_component_file', { id: 'builtin-swipe-deck', name: 'index.html' });
  assert.match(file.text, /--deck-drag:900 50/);
  await assert.rejects(readFile(path.join(dir, 'library.json')), { code: 'ENOENT' });
});

test('读取个人库、匹配中英文全屏轮播并按原始 ID 打开详情、资源和源码', async t => {
  const { dir, client } = await setup(t);
  const library = {
    resources: [
      {
        id: fixtureId, name: '沉浸式幻灯片', originalName: 'Full-screen Image Carousel',
        caseType: '组件', componentCategory: '图集与轮播', description: '铺满视口的照片轮播',
        url: 'https://example.com/gallery', primarySourceAuthor: 'Example Author',
        prompt: '保留图像切换行为。', filePackage: 'fullscreen',
      },
      { id: 'card-carousel', name: '图像卡片轮播', caseType: '组件', componentCategory: '图集与轮播' },
      { id: 'archived', name: '全屏图像轮播（归档）', caseType: '组件', archived: true },
      { id: 'my-page', name: '整页图像轮播', caseType: '网页参考', pageCategory: '作品集' },
      { id: 'legacy', name: '旧版组件', caseType: '组件', sourceFiles: [{ name: '旧版.css' }] },
    ],
    lessons: [{ id: 'light-study', title: '光影学习', explanation: '独立检索标记' }],
    styles: [{ id: 'ilia-liquid-cutout', description: '用户补充说明' }],
    customFonts: [{ id: 'private-font', name: '个人字体' }],
    projects: [{ id: 'design-project', name: '首页设计', componentIds: [fixtureId] }],
    inbox: [{ id: 'reference-image', title: '海报参考', assets: [{ name: '海报.png', url: '/api/assets/' + assetId }] }],
    pinterestBoards: [{ id: 'board', name: '插画' }],
    componentCart: [fixtureId],
  };
  await mkdir(path.join(dir, 'packages'));
  await mkdir(path.join(dir, 'assets'));
  const legacyPath = path.join(dir, 'components', 'legacy');
  await mkdir(legacyPath, { recursive: true });
  await writeJson(path.join(legacyPath, 'manifest.json'), { id: 'legacy' });
  await writeFile(path.join(legacyPath, '旧版.css'), '.card { display: grid; }');
  await writeFile(path.join(legacyPath, 'unlisted.css'), '/* not registered */');
  await writeFile(path.join(dir, 'assets', assetId), Buffer.from([1, 2, 3]));
  await writeJson(path.join(dir, 'packages/fullscreen.json'), { files: [{ name: '轮播.mjs', content: sourceText }] });
  await writeJson(path.join(dir, 'library.json'), library);
  const savedBytes = await readFile(path.join(dir, 'library.json'), 'utf8');

  for (const query of ['全屏的图像轮播有哪些组件？', 'fullscreen image carousel']) {
    const result = await call(client, 'search_components', { query });
    assert.equal(result.mode, 'local_library');
    assert.deepEqual(result.items.map(item => item.id), [fixtureId]);
    assert.equal(result.items[0].upstreamUrl, 'https://example.com/gallery');
    assert.equal(result.items[0].preview.url, previewOrigin + '/#/components/' + encodeURIComponent(fixtureId));
  }

  const archived = await call(client, 'search_library', { kind: 'component', query: '归档', includeArchived: true });
  assert.equal(archived.items[0].id, 'archived');
  assert.equal(archived.items[0].archived, true);
  assert.equal(archived.items[0].preview, null);

  const first = await call(client, 'search_components', { category: '图集与轮播', limit: 1 });
  const second = await call(client, 'search_components', { category: '图集与轮播', limit: 1, offset: first.nextOffset });
  assert.ok(first.total >= 2);
  assert.equal(second.total, first.total);
  assert.equal(second.nextOffset, first.total > 2 ? 2 : null);
  assert.notEqual(first.items[0].id, second.items[0].id);
  const seeded = await call(client, 'get_record', { kind: 'component', id: 'motion-prompt-059' });
  assert.equal(seeded.summary.source, 'public_seed');
  assert.ok(seeded.files.includes('LICENSE'));
  assert.equal(seeded.summary.detailUrl, 'http://127.0.0.1:4318/components/motion-prompt-059');
  assert.equal(seeded.summary.preview.url, seeded.summary.detailUrl);
  assert.equal(seeded.summary.upstreamUrl, null);

  const details = await call(client, 'get_record', { kind: 'component', id: fixtureId, limit: 40 });
  assert.deepEqual(details.files, ['轮播.mjs', 'PROMPT.md']);
  assert.equal(details.nextOffset, 40);
  const next = await call(client, 'get_record', { kind: 'component', id: fixtureId, offset: details.nextOffset });
  assert.equal(JSON.parse(details.text + next.text).primarySourceAuthor, 'Example Author');

  const resource = await client.readResource({ uri: details.summary.resourceUri });
  assert.equal(JSON.parse(resource.contents[0].text).id, fixtureId);
  const snippet = await call(client, 'read_component_file', { id: fixtureId, name: '轮播.mjs', limit: 5 });
  const rest = await call(client, 'read_component_file', { id: fixtureId, name: '轮播.mjs', offset: snippet.nextOffset });
  assert.equal(snippet.text + rest.text, sourceText);
  assert.ok(snippet.text.endsWith('📷'));
  const legacy = await call(client, 'get_record', { kind: 'component', id: 'legacy' });
  assert.deepEqual(legacy.files, ['旧版.css']);
  const legacyCss = await call(client, 'read_component_file', { id: 'legacy', name: '旧版.css' });
  assert.equal(legacyCss.text, '.card { display: grid; }');

  for (const [kind, query, id] of [
    ['lesson', '独立检索标记', 'light-study'], ['style', '用户补充说明', 'ilia-liquid-cutout'],
    ['font', '个人字体', 'private-font'], ['project', '首页设计', 'design-project'],
    ['capture', '海报参考', 'reference-image'], ['pinterest_board', '插画', 'board'],
    ['library_settings', '', 'library-settings'], ['asset', '海报.png', assetId],
  ]) {
    const found = await call(client, 'search_library', { kind, ...(query && { query }) });
    assert.equal(found.items[0]?.id, id);
  }
  assert.equal(await readFile(path.join(dir, 'library.json'), 'utf8'), savedBytes);
});

test('本机 MCP 的已发布 ID 统一链接到配置的网站，个人收藏继续保留来源与本机预览', async t => {
  const origin = 'https://ilia.example.com';
  const { dir, client } = await setup(t, { ILIACACHE_PUBLIC_BASE_URL: origin });
  await writeJson(path.join(dir, 'library.json'), { resources: [
    { id: 'motion-prompt-059', name: '个人覆盖', caseType: '组件',
      url: 'https://private.example.com/capture', prompt: 'local private note',
      referencePreview: { kind: 'image', url: 'https://private.example.com/thumb.png', sourcePageUrl: 'https://private.example.com/capture' } },
    { id: 'personal-toggle', name: '私人开关', caseType: '组件',
      url: 'https://private.example.com/toggle', prompt: 'personal motion reference',
      referencePreview: { kind: 'video', url: 'https://private.example.com/toggle.mp4', sourcePageUrl: 'https://private.example.com/toggle' } },
  ] });
  const id = 'motion-prompt-059';
  const expected = origin + '/components/' + id;
  const search = await call(client, 'search_components', { query: id });
  const detail = await call(client, 'get_record', { kind: 'component', id });
  const handoff = await call(client, 'get_component_handoff', { id });
  for (const summary of [search.items[0], detail.summary, handoff.summary]) {
    assert.equal(summary.detailUrl, expected);
    assert.deepEqual(summary.preview, { kind: 'website_url', url: expected });
    assert.equal(summary.upstreamUrl, null);
  }
  for (const summary of [search.items[0], detail.summary]) assert.equal(summary.referencePreview, undefined);
  assert.equal(handoff.summary.referencePreview.url, 'https://private.example.com/thumb.png');
  const resource = await client.readResource({ uri: detail.summary.resourceUri });
  assert.doesNotMatch(JSON.stringify([detail, resource]), /showheyohtaki\.github\.io|private\.example\.com|local private note/);
  assert.doesNotMatch(JSON.stringify(handoff), /showheyohtaki\.github\.io|local private note/);
  const privateItem = await call(client, 'get_component_handoff', { id: 'personal-toggle' });
  assert.equal(privateItem.summary.detailUrl, previewOrigin + '/#/components/personal-toggle');
  assert.equal(privateItem.summary.upstreamUrl, 'https://private.example.com/toggle');
  assert.equal(privateItem.summary.referencePreview.url, 'https://private.example.com/toggle.mp4');
  assert.equal(privateItem.prompt, 'personal motion reference');
});

test('本机 MCP 识别只有显式分类的组件，详情和文件操作均遵守源码限制', async t => {
  const { dir, client } = await setup(t);
  const files = [{ name: 'example.js', content: 'test-only private source' }];
  const prompt = '保留原始提示词';
  await writeJson(path.join(dir, 'library.json'), { resources: [
    { id: 'restricted-local', name: '显式分类组件', componentCategory: '文字',
      url: 'https://catalog.example.com/components/restricted', sourcePolicy: 'source-link-only', files, prompt },
    { id: 'source-home', name: '网站首页', url: 'https://catalog.example.com/', kind: '网站' },
    { id: 'reactbits-squish-switch', name: '公开组件的本机旧记录', componentCategory: '按钮与输入', files },
    { id: 'builtin-swipe-deck', name: '本机覆盖的卡组', caseType: '组件', customFiles: true,
      files: [{ name: 'index.html', content: 'test-only private source' }] },
  ] });

  for (const id of ['restricted-local', 'reactbits-squish-switch']) {
    const details = await call(client, 'get_record', { kind: 'component', id });
    assert.doesNotMatch(JSON.stringify(details), /test-only private source|example\.js/);
    const file = await client.callTool({
      name: 'ilia_cache_read_component_file', arguments: { id, name: 'example.js' },
    });
    assert.equal(file.isError, true);
    assert.match(file.content[0].text, /source_restricted/);
  }

  const details = await call(client, 'get_record', { kind: 'component', id: 'restricted-local' });
  assert.deepEqual(details.files, ['PROMPT.md']);
  const website = await call(client, 'get_record', { kind: 'website', id: 'site:catalog.example.com' });
  assert.doesNotMatch(JSON.stringify(website), /restricted-local|test-only private source|example\.js/);
  const originalPrompt = await call(client, 'read_component_file', { id: 'restricted-local', name: 'PROMPT.md' });
  assert.equal(originalPrompt.text, prompt);
  const adaptedPreview = await call(client, 'read_component_file', { id: 'builtin-swipe-deck', name: 'index.html' });
  assert.match(adaptedPreview.text, /<!doctype html>/i);
  assert.doesNotMatch(adaptedPreview.text, /test-only private source/);
});

test('未知编号、非法分页、未登记文件与源码包符号链接均返回可识别错误', async t => {
  const { dir, client } = await setup(t);
  const codeDir = path.join(dir, 'packages');
  await mkdir(codeDir);
  await writeJson(path.join(dir, 'library.json'), {
    resources: [{ id: 'pkg', name: '组件', caseType: '组件', filePackage: 'symbolic' }], lessons: [],
  });
  await symlink('../library.json', path.join(codeDir, 'symbolic.json'), 'file');
  for (const [name, args] of [
    ['search_library', { limit: 0 }],
    ['get_record', { kind: 'component', id: 'missing' }],
    ['read_component_file', { id: 'builtin-swipe-deck', name: '../library.json' }],
    ['read_component_file', { id: 'pkg', name: 'secret.txt' }],
  ]) {
    const result = await client.callTool({ name: 'ilia_cache_' + name, arguments: args });
    assert.equal(result.isError, true);
    assert.ok(result.content[0].text);
    assert.ok(!result.content[0].text.includes(dir));
  }
});
