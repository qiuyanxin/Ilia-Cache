import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {basename} from 'node:path';
import {runInNewContext} from 'node:vm';

const input = process.argv[2];
if (!input) throw Error('请提供 Cache 动效模式库 HTML 文件');
const html = await readFile(input, 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] || '';
const templates = script.split('// ---------- Render ----------')[0];
const css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1];
const bindings = script
  .slice(script.indexOf('function startCount('), script.indexOf('      bindNewPreviews(document);'))
  .replace(/^\s*(startCount|bindMagnetic)\(document\);$/gm, '');
const {patterns, previews} = runInNewContext(
  templates + '\n({patterns: PATTERNS, previews: PREVIEWS})',
  Object.create(null),
  {timeout: 1000, contextCodeGeneration: {strings: false, wasm: false}},
);
if (!css || !bindings.includes('function bindNewPreviews') || patterns.length !== 20 ||
    new Set(patterns.map(p => p.id)).size !== 20 ||
    patterns.some(p => !/^[a-z]+$/.test(p.id) || !previews[p.id])) {
  throw Error('原始动效文件格式不完整');
}

const categories = {
  enter: '滚动与页面切换', text: '文字特效', hover: '悬停与按压',
  scroll: '滚动与页面切换', feedback: '加载与反馈', loop: '打字与滚动', layout: '内容卡片',
};
const dataDir = new URL('../data/', import.meta.url);
const libraryEndpoint = 'http://127.0.0.1:4317/api/library';
const response = await fetch(libraryEndpoint);
if (!response.ok) throw Error('无法读取本机组件库');
const current = await response.json();
const existing = new Set(current.resources.map(r => r.id));
const records = [];

await mkdir(new URL('packages/', dataDir), {recursive: true});
await mkdir(new URL('component-imports/ilia-motion/', dataDir), {recursive: true});
await writeFile(new URL('component-imports/ilia-motion/original.html', dataDir), html, {flag: 'wx'}).catch(error => {
  if (error.code !== 'EEXIST') throw error;
});

for (const [order, p] of patterns.entries()) {
  const id = 'ilia-motion-' + p.id;
  if (existing.has(id)) continue;
  const thumbnailFrame = '/api/component-preview?id=' + id;
  const url = new URL(thumbnailFrame, libraryEndpoint).href;
  const category = p.id === 'marquee' ? 'loop' : p.cat;
  const origin = {author: 'Ilia', collection: 'Cache 动效模式库', originalFile: basename(input), originalId: p.id, url,
    license: '随附说明允许自由使用、修改和发布原创实现。内嵌照片未附单独来源或授权信息。',
    dependencies: []};
  const preview = `<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${p.name}</title>
<style>${css}
html, body, main { width: 100%; height: 100%; }
body { background: transparent; }
body[data-card] .stage .replay, body[data-card] .stage .cat-tag { display: none; }
main .stage { width: 100%; height: 100%; aspect-ratio: auto; border: 0; }
</style>
<main></main>
<template id="preview">
<div class="stage" data-stage="${p.id}">
<span class="cat-tag">${p.catLabel}</span>
${previews[p.id]}
<button class="replay" type="button">↻ 重播</button>
</div>
</template>
<script>
${bindings}
const darkModes = [...document.styleSheets[0].cssRules]
  .filter(rule => rule.media?.mediaText === '(prefers-color-scheme: dark)');
addEventListener('message', event => {
  if (event.source !== parent || event.data?.type !== 'motion:theme') return;
  const theme = event.data.theme;
  if (theme !== 'light' && theme !== 'dark') return;
  for (const rule of darkModes) rule.media.mediaText = theme === 'dark' ? 'all' : 'not all';
});
if (new URLSearchParams(location.search).get('mode') === 'card') document.body.dataset.card = '';
const main = document.querySelector('main');
const template = document.querySelector('#preview');
function renderPreview() {
  main.replaceChildren(template.content.cloneNode(true));
  startCount(main);
  bindMagnetic(main);
  bindNewPreviews(main);
}
main.addEventListener('click', event => {
  if (event.target.closest('.replay')) renderPreview();
});
renderPreview();
</script>
</html>`;
  const files = [
    {name: '动效片段.txt', content: p.code},
    {name: 'index.html', content: preview},
    {name: '模式资料.json', content: JSON.stringify(p, null, 2)},
    {name: 'ORIGIN.json', content: JSON.stringify(origin, null, 2)},
  ];
  const folder = new URL(`components/${id}/`, dataDir);
  await mkdir(folder, {recursive: true});
  for (const file of files) await writeFile(new URL(encodeURIComponent(file.name), folder), file.content);
  await writeFile(new URL(`packages/${id}.json`, dataDir), JSON.stringify({id, files}));
  const description = p.principle.replaceAll(/<\/?strong>/g, '');
  records.push({
    id, name: p.name, originalName: p.en, url,
    category: '组件', kind: '案例', caseType: '组件', componentCategory: categories[category],
    collectionSource: {name: origin.collection, url}, sourceShort: 'Ilia原创实现',
    primarySourceAuthor: origin.author, primarySourceKind: 'original',
    sourcePolicy: 'bundled-source', license: '原创实现 · 自由使用与修改',
    sourceNotice: origin.license, dependencies: origin.dependencies,
    description, note: description, prompt: p.prompt, promptKind: 'original',
    thumbnailFrame, tags: ['Ilia原创实现', p.catLabel.split(' · ')[0]],
    motionPattern: {order, category, label: p.catLabel, principle: p.principle, specs: p.specs, uses: p.uses},
    filePackage: id, sourceFiles: files.map(({name}) => ({name})), files: [],
    created: new Date().toISOString(),
  });
}
if (records.length) {
  const result = await fetch(libraryEndpoint, {
    method: 'POST',
    headers: {Origin: new URL(libraryEndpoint).origin, 'Content-Type': 'application/json'},
    body: JSON.stringify({_patch: true, _changedResources: records.map(r => r.id), resources: records, lessons: []}),
  });
  if (!result.ok) throw Error(await result.text());
}
console.log(`新增 ${records.length} 条，已收录 ${patterns.length} 条。`);
