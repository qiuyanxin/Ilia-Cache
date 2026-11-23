import { readFile, writeFile } from 'node:fs/promises';
import { updateLibrary } from '../library-store.mjs';

const root = new URL('../', import.meta.url);
const seedUrl = new URL('public/seed.json', root);
const catalog = JSON.parse(await readFile(new URL('public/motionsites-pages.json', root), 'utf8'));

if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.records) || catalog.records.length !== catalog.total) {
  throw new Error('MotionSites 页面目录格式不正确');
}

const isExplicitPage = (item) => item?.caseType === '网页参考' || Boolean(item?.pageCategory);
const isImportedMotionSites = (item) => String(item?.id || '').startsWith('page-ms-');

const addedLocally = await updateLibrary(library => {
  const ids = new Set(library.resources.map(record => record.id));
  const newRecords = catalog.records.filter(record => !ids.has(record.id));
  const next = newRecords.length ? { ...library, resources: [...library.resources, ...newRecords] } : null;
  return { next, result: newRecords.length };
});

const seed = JSON.parse(await readFile(seedUrl, 'utf8'));
const nextSeed = [
  ...seed.filter((item) => !isExplicitPage(item) && !isImportedMotionSites(item)),
  ...catalog.records,
];
await writeFile(seedUrl, JSON.stringify(nextSeed, null, 2));

console.log(JSON.stringify({
  addedLocally,
  imported: catalog.records.length,
  exactPrompts: catalog.records.filter((item) => item.promptKind === 'original').length,
  generatedTasks: catalog.records.filter((item) => item.promptKind === 'implementation-task').length,
}, null, 2));
