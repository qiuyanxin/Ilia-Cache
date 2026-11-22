import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const libraryUrl = new URL('data/library.json', root);
const seedUrl = new URL('public/seed.json', root);
const catalog = JSON.parse(await readFile(new URL('public/motionsites-pages.json', root), 'utf8'));

if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.records) || catalog.records.length !== catalog.total) {
  throw new Error('MotionSites 页面目录格式不正确');
}

const isExplicitPage = (item) => item?.caseType === '网页参考' || Boolean(item?.pageCategory);
const isImportedMotionSites = (item) => String(item?.id || '').startsWith('page-ms-');

const library = JSON.parse(await readFile(libraryUrl, 'utf8'));
const previousPages = library.resources.filter((item) => isExplicitPage(item) && !isImportedMotionSites(item));
if (previousPages.length) {
  await writeFile(
    new URL('data/page-library-backup-2026-11-22.json', root),
    JSON.stringify({ exportedAt: new Date().toISOString(), records: previousPages }, null, 2),
  );
}

library.resources = [
  ...library.resources.filter((item) => !isExplicitPage(item) && !isImportedMotionSites(item)),
  ...catalog.records,
];
library.updatedAt = new Date().toISOString();
await writeFile(libraryUrl, JSON.stringify(library, null, 2));

const seed = JSON.parse(await readFile(seedUrl, 'utf8'));
const nextSeed = [
  ...seed.filter((item) => !isExplicitPage(item) && !isImportedMotionSites(item)),
  ...catalog.records,
];
await writeFile(seedUrl, JSON.stringify(nextSeed, null, 2));

console.log(JSON.stringify({
  backedUp: previousPages.length,
  imported: catalog.records.length,
  exactPrompts: catalog.records.filter((item) => item.promptKind === 'original').length,
  generatedTasks: catalog.records.filter((item) => item.promptKind === 'implementation-task').length,
}, null, 2));
