import {mkdir, readFile, writeFile} from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const reference = new URL('references/motion-prompt/', root);
const catalog = JSON.parse(await readFile(new URL('api/v1/catalog.json', reference), 'utf8'));
const license = await readFile(new URL('LICENSE', reference), 'utf8');
const libraryUrl = new URL('data/library.json', root);
const library = JSON.parse(await readFile(libraryUrl, 'utf8'));
const packageDir = new URL('data/packages/', root);
const componentDir = new URL('data/components/', root);
await mkdir(packageDir, {recursive: true});
await mkdir(componentDir, {recursive: true});

const categories = {
  motion: '动效与镜头', motion2: '动效与镜头', camera: '动效与镜头', camera2: '动效与镜头',
  lp: '页面与转场', lp2: '页面与转场', photo: '视觉风格', artstyle: '视觉风格', diagram: '图表与图解',
};
const uiCategories = {'open-overlay': '菜单与导航', 'select-switch': '按钮与输入', 'navigate-status': '提示与状态'};
const posters = new Set(['motion', 'motion2', 'camera', 'camera2', 'lp2']);
const records = [];

for (const item of catalog.elements) {
  const id = `motion-prompt-${item.id}`;
  const source = await readFile(new URL(`api/v1/en/e/${item.id}.txt`, reference), 'utf8');
  const prompt = await readFile(new URL(`api/v1/en/p/${item.id}.txt`, reference), 'utf8');
  const files = [
    {name: `motion-prompt-${item.id}.txt`, content: source},
    {name: 'PROMPT.md', content: prompt},
    {name: 'LICENSE', content: license},
    {name: 'ORIGIN.json', content: JSON.stringify({author: 'Shohei Ohtaki', source: `https://showheyohtaki.github.io/motion-prompt/#${item.id}`, repository: 'https://github.com/showheyohtaki/motion-prompt', license: 'MIT'}, null, 2)},
  ];
  await writeFile(new URL(`${id}.json`, packageDir), JSON.stringify({id, files}));
  const folder = new URL(`${id}/`, componentDir);
  await mkdir(folder, {recursive: true});
  for (const file of files) await writeFile(new URL(file.name, folder), file.content);
  records.push({
    id,
    name: item.name['zh-Hans'] || item.name.en,
    originalName: item.name.en,
    url: `https://showheyohtaki.github.io/motion-prompt/#${item.id}`,
    category: '组件', kind: '案例', caseType: '组件',
    componentCategory: item.pack === 'ui' ? uiCategories[item.category] : categories[item.pack],
    description: item.ask['zh-Hans'] || item.ask.en,
    note: item.meaning['zh-Hans'] || item.meaning.en,
    prompt,
    promptKind: 'original', promptStatus: '官方提示词',
    sourceShort: 'Motion Prompt',
    primarySourceAuthor: 'Shohei Ohtaki',
    primarySourceUrl: `https://github.com/showheyohtaki/motion-prompt`,
    primarySourceKind: 'original',
    collectionSource: {name: 'Motion Prompt', url: `https://showheyohtaki.github.io/motion-prompt/#${item.id}`},
    externalPreview: `/motion-prompt/index.html#${item.id}`,
    localPoster: posters.has(item.pack) ? `/motion-prompt/assets/preview-${item.pack}.gif` : '/motion-prompt/assets/og.png',
    tags: ['Motion Prompt', item.pack, item.category, ...(item.tags || [])],
    cost: '免费', license: 'MIT', gets: '动态预览、提示词、规格、源码',
    filePackage: id, sourceFiles: files.map(({name}) => ({name})), files: [], usage: [],
    created: '2026-11-22T00:00:00.000Z', importedAt: new Date().toISOString(),
  });
}

library.resources = [...library.resources.filter((item) => !String(item.id || '').startsWith('motion-prompt-')), ...records];
library.updatedAt = new Date().toISOString();
await writeFile(libraryUrl, JSON.stringify(library, null, 2));
console.log(JSON.stringify({
  imported: records.length,
  categories: Object.fromEntries(Object.entries(Object.groupBy(records, (item) => item.componentCategory)).map(([name, items]) => [name, items.length])),
}, null, 2));
