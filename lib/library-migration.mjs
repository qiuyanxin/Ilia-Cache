import { isDeepStrictEqual } from 'node:util';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import { loadBuiltinComponents } from '../public/builtin-components.mjs';
import { readLibraryFile } from '../library-files.mjs';
import { readStoredLibrary, withLibraryWrite } from './library-sqlite.mjs';

const collections = [
  'resources', 'lessons', 'inbox', 'styles', 'projects', 'customFonts', 'pinterestBoards',
];
const publicDirectory = new URL('../public/', import.meta.url);
const folderUrl = directory => directory instanceof URL ? directory : pathToFileURL(join(directory, '/'));
const emptyLibrary = () => ({ resources: [], lessons: [] });
let seed;

async function readPublic(path, format) {
  const text = await readFile(new URL(path.replace(/^\//, ''), publicDirectory), 'utf8');
  return format === 'json' ? JSON.parse(text) : text;
}

function readSeed() {
  return seed ??= Promise.all([readPublic('seed.json', 'json'), loadBuiltinComponents(readPublic)])
    .then(([resources, builtins]) => [...resources, ...builtins]);
}

export function validateLibraryState(state) {
  if (!state || typeof state !== 'object' || !Array.isArray(state.resources) || !Array.isArray(state.lessons)) {
    throw new Error('资料格式无效，需要 resources 和 lessons 数组。');
  }
  for (const field of collections) {
    if (state[field] === undefined) continue;
    if (!Array.isArray(state[field]) || state[field].some(record => !record || typeof record !== 'object' ||
      Array.isArray(record))) throw new Error('资料字段格式无效：' + field);
  }
  return state;
}

export async function readLegacyLibrary(directory) {
  const content = await readLibraryFile(new URL('library.json', folderUrl(directory)));
  return content === null ? null : validateLibraryState(JSON.parse(content));
}

function addSeedResources(state, resources) {
  const ids = new Set(state.resources.map(record => record.id));
  const additions = [];
  for (const record of resources) {
    if (ids.has(record.id)) continue;
    ids.add(record.id);
    additions.push(record);
  }
  return { state: { ...state, resources: [...state.resources, ...additions] }, added: additions.length };
}

export async function migrateLibrary(directory, { dryRun = false } = {}) {
  const current = readStoredLibrary(directory);
  if (current) return { state: current, source: 'sqlite', added: 0, changed: false };
  const legacy = await readLegacyLibrary(directory);
  const result = addSeedResources(legacy || emptyLibrary(), await readSeed());
  result.source = legacy ? 'json' : 'seed';
  result.changed = !dryRun;
  if (dryRun) return result;
  return withLibraryWrite(directory, (existing, save) => {
    if (existing) return { state: existing, source: 'sqlite', added: 0, changed: false };
    save(result.state);
    return result;
  });
}

export async function importMissingSeedRecords(directory, { dryRun = false } = {}) {
  if (dryRun) {
    const current = await migrateLibrary(directory, { dryRun: true });
    const next = addSeedResources(current.state, await readSeed());
    return { ...next, added: current.added + next.added, changed: false };
  }
  await migrateLibrary(directory);
  const resources = await readSeed();
  return withLibraryWrite(directory, (current, save) => {
    const result = addSeedResources(current, resources);
    if (result.added) {
      result.state.updatedAt = new Date().toISOString();
      save(result.state);
    }
    return { ...result, changed: Boolean(result.added) };
  });
}

function compareBrowserExport(current, browser) {
  const next = { ...current };
  const conflicts = [];
  let added = 0;
  for (const field of collections) {
    const records = [...(current[field] || [])];
    const saved = new Map(records.filter(record => record.id).map(record => [record.id, record]));
    for (const record of browser[field] || []) {
      const existing = saved.get(record.id);
      if (existing) {
        if (!isDeepStrictEqual(existing, record)) {
          conflicts.push({ field, id: record.id, current: existing, browser: record });
        }
      } else if (!records.some(item => !record.id && isDeepStrictEqual(item, record))) {
        if (record.id) saved.set(record.id, record);
        records.push(record);
        added++;
      }
    }
    if (current[field] || browser[field]) next[field] = records;
  }
  for (const [field, value] of Object.entries(browser)) {
    if (collections.includes(field) || field === 'version' || field === 'updatedAt' || field.startsWith('_')) continue;
    if (!Object.hasOwn(current, field)) {
      Object.defineProperty(next, field, { value, enumerable: true, writable: true, configurable: true });
      added++;
    } else if (!isDeepStrictEqual(current[field], value)) {
      conflicts.push({ field, current: current[field], browser: value });
    }
  }
  return { next, added, conflicts };
}

export async function importBrowserLibrary(directory, exportFile, reportFile) {
  const browser = validateLibraryState(JSON.parse(await readFile(exportFile, 'utf8')));
  await migrateLibrary(directory);
  return withLibraryWrite(directory, async (current, save) => {
    const { next, added, conflicts } = compareBrowserExport(current, browser);
    const report = {
      version: 1, createdAt: new Date().toISOString(),
      strategy: '保留当前 SQLite 资料，浏览器独有资料可合并。', added, conflicts,
    };
    await writeFile(reportFile, JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    if (added) {
      next.updatedAt = new Date().toISOString();
      save(next);
    }
    return { added, conflicts: conflicts.length };
  });
}
