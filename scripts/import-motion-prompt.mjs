import {lstat, mkdir, readFile} from 'node:fs/promises';
import { libraryDirectory } from '../library-location.mjs';
import { updateLibrary, writeLibraryFile } from '../library-store.mjs';

const root = new URL('../', import.meta.url);
const reference = new URL('references/motion-prompt/', root);
const catalog = JSON.parse(await readFile(new URL('api/v1/catalog.json', reference), 'utf8'));
const license = await readFile(new URL('LICENSE', reference), 'utf8');
const packageDir = new URL('packages/', libraryDirectory);
const componentDir = new URL('components/', libraryDirectory);

const categories = {
  motion: '动效与镜头', motion2: '动效与镜头', camera: '动效与镜头', camera2: '动效与镜头',
  lp: '页面与转场', lp2: '页面与转场', photo: '视觉风格', artstyle: '视觉风格', diagram: '图表与图解',
};
const uiCategories = {'open-overlay': '菜单与导航', 'select-switch': '按钮与输入', 'navigate-status': '提示与状态'};
const records = [];
const packages = [];

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
  packages.push({ id, files });
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
    tags: ['Motion Prompt', item.pack, item.category, ...(item.tags || [])],
    cost: '免费', license: 'MIT', gets: '动态预览、提示词、规格、源码',
    filePackage: id, sourceFiles: files.map(({name}) => ({name})), files: [], usage: [],
    created: '2026-11-22T00:00:00.000Z', importedAt: new Date().toISOString(),
  });
}

async function writeMissing(file, content) {
  try {
    if (!(await lstat(file)).isFile()) throw new Error('源码归档位置必须是普通文件。');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await writeLibraryFile(file, content);
  }
}

await updateLibrary(async library => {
  await mkdir(packageDir, {recursive: true});
  for (const { id, files } of packages) {
    await writeMissing(new URL(`${id}.json`, packageDir), JSON.stringify({id, files}));
    const folder = new URL(`${id}/`, componentDir);
    await mkdir(folder, {recursive: true});
    for (const file of files) await writeMissing(new URL(file.name, folder), file.content);
  }
  const imported = new Map(records.map(record => [record.id, record]));
  const resources = library.resources.map(record => {
    const source = imported.get(record.id);
    imported.delete(record.id);
    return source ? { ...source, ...record, filePackage: record.filePackage || source.filePackage } : record;
  });
  return { next: { ...library, resources: [...resources, ...imported.values()] } };
});
console.log(JSON.stringify({
  imported: records.length,
  categories: Object.fromEntries(Object.entries(Object.groupBy(records, (item) => item.componentCategory)).map(([name, items]) => [name, items.length])),
}, null, 2));
