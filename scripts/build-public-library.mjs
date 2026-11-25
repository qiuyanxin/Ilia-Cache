import { existsSync } from 'node:fs';
import { lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { libraryDirectory } from '../library-location.mjs';
import { buildPublicCatalog, projectPublicComponentBundle, publicUrl } from '../lib/public-catalog.mjs';
import { isComponentRecord } from '../public/component-taxonomy.mjs';

const publicDir = new URL('../public/', import.meta.url);
const previewRoots = ['/component-posters/', '/motion/', '/motion-prompt/', '/motion-prompt-preview/', '/previews/', '/sounds/'];
const textFields = [
  'id', 'name', 'displayTitle', 'url', 'category', 'kind', 'caseType', 'componentCategory', 'pageCategory', 'sourceCategory',
  'prompt', 'promptKind', 'promptStatus', 'note', 'description', 'originalDescription', 'originalDisplayName',
  'created', 'importedAt', 'previewDate', 'pageTitle', 'sourceNotice', 'originalUrl', 'primarySourceUrl',
  'primarySourceAuthor', 'primarySourceKind', 'sourceShort', 'sourcePageUrl', 'sourcePageKind', 'sourcePolicy',
  'license', 'gets', 'cost', 'source', 'sourceDetail', 'originalName', 'soundRecipe', 'access',
  'builtin', 'builtinNative',
];
const previewFields = ['preview', 'previewUrl', 'externalPreview', 'thumbnailFrame', 'localPoster', 'previewVideo', 'previewPoster', 'reactPreview'];

async function realPathIfPresent(path) {
  try { return await realpath(path); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}

async function pathExists(path) {
  try { await lstat(path); return true; }
  catch (error) { if (error.code !== 'ENOENT') throw error; return false; }
}

function allowedPreview(value) {
  if (typeof value !== 'string' || !value) return false;
  if (!value.startsWith('/')) return Boolean(publicUrl(value));
  if (value.startsWith('//')) return false;
  const url = new URL(value.slice(1), publicDir);
  return url.href.startsWith(publicDir.href) &&
    (url.pathname === new URL('native-preview.html', publicDir).pathname ||
      previewRoots.some(root => url.pathname.startsWith(new URL(root.slice(1), publicDir).pathname))) && existsSync(url);
}

function stringsFrom(value, fields) {
  return Object.fromEntries(fields.filter(key => typeof value?.[key] === 'string').map(key => [key, value[key]]));
}

function publicResource(resource) {
  const row = stringsFrom(resource, textFields);
  for (const key of ['favorite', 'sourceLinkAvailable']) {
    if (typeof resource[key] === 'boolean') row[key] = resource[key];
  }
  if (Array.isArray(resource.tags)) row.tags = resource.tags.filter(value => typeof value === 'string');
  if (resource.collectionSource) row.collectionSource = stringsFrom(resource.collectionSource, ['name', 'url']);
  if (resource.provenance) row.provenance = stringsFrom(resource.provenance, [
    'kind', 'provider', 'implementation', 'designReference', 'designAuthor', 'license', 'url', 'upstreamSource', 'original', 'author',
  ]);
  if (Array.isArray(resource.media)) row.media = resource.media.filter(media => allowedPreview(media?.url)).map(media => ({
    ...stringsFrom(media, ['type', 'url']), ...(allowedPreview(media.poster) ? { poster: media.poster } : {}),
  }));
  for (const key of ['url', 'originalUrl', 'primarySourceUrl', 'sourcePageUrl']) {
    if (row[key] && !publicUrl(row[key])) throw new Error('已审核条目含有非公开网址：' + row.id + ' / ' + key);
  }
  for (const key of previewFields) if (allowedPreview(resource[key])) row[key] = resource[key];
  if (row.license?.startsWith('MIT + Commons Clause')) row.license = 'MIT + Commons Clause，保留原始许可；不对外再分发组件集合';
  if (!isComponentRecord(row)) return row;

  const host = publicUrl(row.url)?.hostname.replace(/^www\./, '');
  if (host === 'reactbits.dev' || host === 'transitions.dev') {
    row.primarySourceAuthor ||= host === 'reactbits.dev' ? 'David Haz' : 'Jakub Antalík';
    row.sourceShort ||= host === 'reactbits.dev' ? 'React Bits' : 'Transitions.dev';
    row.sourcePolicy = 'official-source-only';
  }
  row.sourcePageUrl ||= row.id === 'builtin-spinning-counter'
    ? 'https://transitions.dev/detail.html?t=spinning-counter'
    : host === 'transitions.dev' ? row.externalPreview || row.url
      : ['reactbits.dev', 'showheyohtaki.github.io'].includes(host) || row.sourceLinkAvailable === false
        ? row.url : row.primarySourceUrl || row.url;
  row.sourcePageKind ||= row.sourceLinkAvailable === false ? 'collection' : 'primary';
  row.sourcePolicy ||= resource.filePackage ? 'bundled-source' : 'source-link-only';
  if (row.sourcePolicy === 'bundled-source') {
    row.filePackage = resource.filePackage;
    row.sourceFiles = Array.isArray(resource.sourceFiles) ? resource.sourceFiles.map(file => stringsFrom(file, ['name'])) : [];
  }
  return row;
}

async function readReviewedBundle(packages, id) {
  const file = join(packages, id + '.json');
  try {
    if (!(await lstat(packages)).isDirectory() || !(await lstat(file)).isFile()) throw new Error('需要普通目录和文件');
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    throw new Error('已审核源码包无法读取：' + id, { cause: error });
  }
}

const { values } = parseArgs({ options: { 'reviewed-input': { type: 'string' }, output: { type: 'string' } } });
if (!values['reviewed-input']) {
  throw new Error('用法：node scripts/build-public-library.mjs --reviewed-input 已审核导出.json [--output 新目录]');
}
const input = await realpath(resolve(values['reviewed-input']));
const privateRoots = await Promise.all([libraryDirectory, new URL('../data/', import.meta.url)].map(async directory => {
  const path = resolve(fileURLToPath(directory));
  return await realPathIfPresent(path) || path;
}));
if (privateRoots.some(directory => input === directory || input.startsWith(directory + sep))) {
  throw new Error('请把逐项审核的公开导出和对应源码包放在个人资料目录之外。');
}
const state = JSON.parse(await readFile(input, 'utf8'));
if (!Array.isArray(state.resources)) throw new Error('已审核导出缺少 resources。');
const resources = state.resources.filter(resource => resource && !resource.archived).map(publicResource);
const ids = new Set();
for (const row of resources) {
  if (!row.id || ids.has(row.id)) throw new Error('已审核导出包含缺失或重复的资源 ID：' + (row.id || '空'));
  ids.add(row.id);
}
const published = new Map(buildPublicCatalog(resources).components.map(record => [record.id, record]));
const bundles = new Map();
for (const row of resources) {
  if (row.sourcePolicy !== 'bundled-source') continue;
  const record = published.get(row.id);
  if (!record?.files.length) throw new Error('条目不符合公开源码声明：' + row.id);
  const bundle = await readReviewedBundle(join(dirname(input), 'packages'), record.id);
  bundles.set(record.id, projectPublicComponentBundle(record, bundle));
  row.sourceFiles = record.files.map(name => ({ name }));
}

const destination = values.output ? resolve(values.output) : join(await mkdtemp(join(tmpdir(), 'ilia-reviewed-')), 'public');
const parent = await realpath(dirname(destination));
const output = join(parent, basename(destination));
if (await pathExists(output)) throw new Error('公开导出目录已存在：' + output);
const staging = await mkdtemp(join(parent, '.ilia-public-'));
try {
  const packages = join(staging, 'component-packages');
  await mkdir(packages);
  for (const [id, bundle] of bundles) await writeFile(join(packages, id + '.json'), JSON.stringify(bundle));
  await writeFile(join(staging, 'seed.json'), JSON.stringify(resources, null, 2) + '\n');
  await rename(staging, output);
} finally {
  await rm(staging, { recursive: true, force: true });
}
console.log('已生成公开导出：' + output);
console.log(`资源 ${resources.length} 项，源码包 ${bundles.size} 个。`);
