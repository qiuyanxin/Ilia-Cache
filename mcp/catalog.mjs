import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { groupSites, validPublicWebUrl } from '../public/catalog.mjs';
import { loadBuiltinComponents } from '../public/builtin-components.mjs';
import { allowsComponentSource, componentCategory, isComponentRecord, normalizeOriginalMotionRecord, sourceName, sourcePage } from '../public/component-taxonomy.mjs';
import { compareComponentTitles, componentSearchFields, createSearchRanker, normalizeSearchText, prepareSearchQuery } from '../public/component-search.mjs';
import { isPageRecord } from '../public/page-taxonomy.mjs';
import { localImageAttachment, localMediaAttachment } from '../public/reference-media-model.mjs';
import { buildPublicCatalog, projectPublicComponentBundle } from '../lib/public-catalog.mjs';

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const defaultDataDir = fileURLToPath(new URL('../data/', import.meta.url));
const maxLocalBytes = 64 * 1024 * 1024;
const packageId = /^[a-z\d_-]+$/i;
const uploadId = /^[a-f\d-]+\.[a-z\d]+$/i;
const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
const array = value => Array.isArray(value) ? value : [];
const asText = value => typeof value === 'string' ? value : '';
const summarizeText = (value, limit) => asText(value).slice(0, limit);
const containsWebLink = /https?:\/\/|\bwww\.|(?:^|[\s("'\x60])\/\/[^\s.]+\./iu;

function allowsLocalSource(record, publishedRecord) {
  return allowsComponentSource(record, { allowUnclassified: true }) &&
    (!publishedRecord || allowsComponentSource(publishedRecord));
}

export const kinds = [
  'component', 'website', 'page', 'resource', 'style', 'font', 'lesson',
  'capture', 'project', 'site_summary', 'pinterest_board', 'library_settings', 'asset',
];

const readPublic = async (name, format = 'json') => {
  const text = await readFile(path.join(publicDir, name), 'utf8');
  return format === 'json' ? JSON.parse(text) : text;
};
let publicSeedRead;
const readPublicSeed = () => publicSeedRead ??= readPublic('seed.json');
let seedReads;
const seeds = () => seedReads ??= Promise.all([
  readPublicSeed(), loadBuiltinComponents(readPublic), readPublic('design-styles.json'),
  readPublic('font-catalog.json'), readPublic('site-summaries.json'),
]);
let publicCatalogRead;
function publishedSnapshot() {
  return publicCatalogRead ??= readPublicSeed().then(seed => {
    const catalog = buildPublicCatalog(seed);
    return { ...catalog, byId: new Map(catalog.components.map(record => [record.id, record])) };
  });
}

export function localOrigin(value) {
  const url = new URL(value || 'http://127.0.0.1:4317');
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname) ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('ILIACACHE_PREVIEW_BASE_URL 必须是本机 Ilia-Cache 站点的 HTTP origin。');
  }
  return url.origin;
}

// All segments come from known layouts or validated record identifiers. Refuse symlinks
// below the configured data directory so package records cannot expose unrelated files.
async function localEntry(root, segments) {
  try {
    let file = root;
    for (const [index, segment] of segments.entries()) {
      file = path.join(file, segment);
      const stat = await lstat(file);
      if (stat.isSymbolicLink()) throw new Error('资料库中的符号链接不能通过 MCP 读取。');
      if (index === segments.length - 1) return { file, stat };
      if (!stat.isDirectory()) throw new Error('资料库目录结构无效。');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return null;
}

async function readLocal(root, segments, format = 'json') {
  const entry = await localEntry(root, segments);
  if (!entry) return null;
  if (!entry.stat.isFile() || entry.stat.size > maxLocalBytes) {
    throw new Error('资料文件无法读取或超过 64 MiB 上限。');
  }
  const text = await readFile(entry.file, 'utf8');
  try {
    return format === 'json' ? JSON.parse(text) : text;
  } catch {
    throw new Error('本机资料库 JSON 无法解析，请检查或恢复备份。');
  }
}

function assetReferences(saved) {
  const links = new Map();
  const pending = [saved];
  while (pending.length) {
    const entry = pending.pop();
    if (!isObject(entry) && !Array.isArray(entry)) continue;
    const link = typeof entry.url === 'string' && entry.url.match(/^\/api\/assets\/([a-f\d-]+\.[a-z\d]+)$/i);
    if (link && typeof entry.name === 'string') links.set(link[1], entry);
    for (const child of Object.values(entry)) {
      if (child && typeof child === 'object') pending.push(child);
    }
  }
  return links;
}

function overlay(seed, saved, merge = (_, next) => next) {
  const entries = new Map(seed.map(record => [record.id, record]));
  for (const record of array(saved)) {
    if (typeof record?.id === 'string') entries.set(record.id, merge(entries.get(record.id), record));
  }
  return [...entries.values()];
}

function mergeStyle(previous, current) {
  const references = new Map(
    [...array(previous?.references), ...array(current.references)].map(reference => [reference.image, reference]),
  );
  return {
    ...previous,
    ...current,
    references: [...references.values()].filter(reference => !array(current.removedReferences).includes(reference.image)),
  };
}

function rankLocal({ record, summary, publishedRecord }, query, category, source, searchBody) {
  if (category && normalizeSearchText(summary.category) !== category) return -1;
  const readBody = searchBody ? () => JSON.stringify(record) : undefined;
  if (summary.kind === 'component') {
    const label = publishedRecord?.sourceName || sourceName(record);
    if (source && source !== sourceFilter(label)) return -1;
    return createSearchRanker(componentSearchFields(publishedRecord || record, {
      category: summary.category, source: label, url: publishedRecord?.sourcePageUrl || sourcePage(record),
      localMetadata: [record.note, record.name, record.url, record.primarySourceUrl, record.sourcePageUrl]
        .filter(value => typeof value === 'string').join(' '),
    }), readBody || (() => record.prompt || publishedRecord?.prompt))(query);
  }
  const metadata = [
    summary.id, summary.description, summary.category, ...summary.tags, record.note,
    record.url, record.primarySourceUrl, record.sourcePageUrl, record.source, record.english, record.title,
    record.sourceName, record.sourceShort, summary.sourceAuthor, summary.upstreamUrl,
  ].filter(value => typeof value === 'string').join(' ');
  return createSearchRanker({ title: [summary.title, record.originalName].join(' '), metadata }, readBody)(query);
}

const publishedRankers = new WeakMap();
function rankPublished(record, query) {
  let rank = publishedRankers.get(record);
  if (!rank) {
    rank = createSearchRanker(componentSearchFields(record), () => record.prompt);
    publishedRankers.set(record, rank);
  }
  return rank(query);
}

const sourceFilter = value => asText(value).normalize('NFKC').trim().toLowerCase();

function resultPage(items, offset, limit) {
  const end = Math.min(offset + limit, items.length);
  return { items: items.slice(offset, end), total: items.length, nextOffset: end < items.length ? end : null };
}

export function textPage(text, offset, limit) {
  let end = Math.min(offset + limit, text.length);
  // Avoid splitting a UTF-16 surrogate pair between responses.
  if (end > offset && /[\uD800-\uDBFF]/u.test(text[end - 1]) && end < text.length) end += 1;
  return { text: text.slice(offset, end), total: text.length, nextOffset: end < text.length ? end : null };
}

export function createCatalog({
  dataDir = process.env.ILIACACHE_DATA_DIR || process.env.ILIA_DATA_DIR || defaultDataDir,
  previewBaseUrl = process.env.ILIACACHE_PREVIEW_BASE_URL,
  baseUrl = process.env.ILIACACHE_PUBLIC_BASE_URL,
} = {}) {
  const root = path.resolve(dataDir);
  const origin = localOrigin(previewBaseUrl);
  const publicOrigin = websiteOrigin(baseUrl);
  const localUrl = route => ({ kind: 'local_url', url: new URL(route, origin).href });

  function savedReference(reference) {
    if (!['image', 'video'].includes(reference?.kind)) return {};
    const url = localMediaAttachment.test(reference.url) ? localUrl(reference.url).url : validPublicWebUrl(reference.url);
    const sourcePageUrl = validPublicWebUrl(reference.sourcePageUrl);
    if (!url || !sourcePageUrl) return {};
    const poster = reference.kind === 'video' && (localImageAttachment.test(reference.poster)
      ? localUrl(reference.poster).url : validPublicWebUrl(reference.poster));
    const referencePreview = { kind: reference.kind, url, sourcePageUrl, ...(poster ? { poster } : {}) };
    for (const key of ['label', 'provenance']) {
      if (typeof reference[key] === 'string' && reference[key]) referencePreview[key] = reference[key];
    }
    for (const key of ['width', 'height', 'duration']) {
      if (Number.isFinite(reference[key]) && reference[key] > 0) referencePreview[key] = reference[key];
    }
    return { referencePreview };
  }

  async function snapshot() {
    const [[seed, builtins, styleSeed, fontSeed, summaries], published, saved, assets] = await Promise.all([
      seeds(), publishedSnapshot(), readLocal(root, ['library.json']), localEntry(root, ['assets']),
    ]);
    if (saved !== null && (!isObject(saved) || !Array.isArray(saved.resources))) {
      throw new Error('本机 library.json 缺少 resources 列表。请检查资料库备份。');
    }
    const source = saved ? 'local_library' : 'public_seed';
    const rows = [];
    function add(kind, record, provenance = source) {
      if (typeof record?.id !== 'string' || !record.id) return;
      const id = record.id;
      const publishedRecord = kind === 'component' && published.byId.get(id);
      const reference = savedReference(record.referencePreview);
      if (publishedRecord) {
        const summary = publishedSummary(publishedRecord, publicOrigin, provenance);
        rows.push({ record, publishedRecord, reference, summary: { ...summary, archived: Boolean(record.archived) } });
        return;
      }
      const upstreamUrl = validPublicWebUrl(sourcePage(record)) || null;
      let preview = null;
      if (kind === 'component' && !record.archived) preview = localUrl('/#/components/' + encodeURIComponent(id.toWellFormed()));
      if (kind === 'asset') preview = localUrl('/api/assets/' + id);
      if (kind === 'page' && !record.archived) preview = localUrl('/#/pages/' + encodeURIComponent(id.toWellFormed()));
      const interactive = record.preview;
      const interactiveUrl = interactive?.kind === 'html' &&
        /^\/api\/component-previews\/[a-f\d]{64}$/.test(interactive.url) ? localUrl(interactive.url).url : null;
      rows.push({
        record,
        summary: {
          id, kind, source: provenance, archived: Boolean(record.archived), upstreamUrl, preview,
          ...(kind === 'component' && preview ? { detailUrl: preview.url } : {}),
          ...reference,
          ...(interactiveUrl ? { interactivePreview: { kind: 'html', url: interactiveUrl } } : {}),
          sourceAuthor: summarizeText(record.primarySourceAuthor, 150) || null,
          title: summarizeText(record.name || record.title || record.displayTitle || id, 180),
          description: summarizeText(record.description || record.note || record.finds, 360),
          category: summarizeText(kind === 'component' ? componentCategory(record) :
            record.pageCategory || record.category || record.group, 100),
          tags: array(record.tags).filter(tag => typeof tag === 'string').slice(0, 20).map(tag => tag.slice(0, 80)),
          resourceUri: 'ilia-cache://records/' + kind + '/id-' + encodeURIComponent(id.toWellFormed()),
        },
      });
    }

    const builtinMap = new Map(builtins.map(record => [record.id, record]));
    const raw = overlay(seed, saved?.resources).map(normalizeOriginalMotionRecord);
    const savedIds = new Set(array(saved?.resources).map(record => record?.id));
    const records = new Map(raw.filter(record => typeof record?.id === 'string').map(record => [record.id, record]));
    for (const [id, builtin] of builtinMap) {
      const existing = records.get(id);
      records.set(id, existing ? (existing.customFiles ? existing : { ...existing, files: builtin.files }) : builtin);
    }
    const websiteInputs = [];
    const typeOptions = { includeArchived: true };
    for (const record of records.values()) {
      const kind = isComponentRecord(record, typeOptions) ? 'component' : isPageRecord(record, typeOptions) ? 'page' : 'resource';
      if (kind === 'resource') websiteInputs.push(record);
      const provenance = record === builtinMap.get(record.id) ? 'bundled'
        : savedIds.has(record.id) ? 'local_library' : 'public_seed';
      add(kind, record, provenance);
    }
    for (const website of groupSites(websiteInputs)) {
      add('website', { ...website, ...summaries[website.domain], ...saved?.siteOverrides?.[website.domain],
        id: website.id, url: saved?.siteOverrides?.[website.domain]?.homeUrl || website.url });
    }
    for (const [id, summary] of Object.entries(summaries)) add('site_summary', { ...summary, id }, 'public_seed');
    for (const style of overlay(styleSeed, saved?.styles, mergeStyle)) {
      add('style', style, array(saved?.styles).some(custom => custom.id === style.id) ? source : 'public_seed');
    }
    const removedFonts = new Set(array(saved?.removedFontIds));
    for (const font of overlay(fontSeed, saved?.customFonts)) {
      const provenance = fontSeed.includes(font) ? 'public_seed' : source;
      add('font', removedFonts.has(font.id) ? { ...font, archived: true } : font, provenance);
    }
    const stateKinds = { lessons: 'lesson', inbox: 'capture', projects: 'project', pinterestBoards: 'pinterest_board' };
    for (const [field, kind] of Object.entries(stateKinds)) {
      for (const [index, record] of array(saved?.[field]).entries()) {
        if (isObject(record)) add(kind, { ...record, id: record.id || field + '-' + (index + 1) });
      }
    }
    if (saved) {
      const dataFields = new Set(['resources', 'styles', 'customFonts', ...Object.keys(stateKinds)]);
      const settings = Object.fromEntries(Object.entries(saved).filter(([key]) => !dataFields.has(key)));
      add('library_settings', { ...settings, id: 'library-settings', name: '本机资料库设置' });
    }
    if (assets?.stat.isDirectory()) {
      const links = assetReferences(saved);
      for (const entry of await readdir(assets.file, { withFileTypes: true })) {
        if (!entry.isFile() || !uploadId.test(entry.name)) continue;
        const reference = links.get(entry.name);
        add('asset', { ...reference, id: entry.name, url: '/api/assets/' + entry.name }, 'local_library');
      }
    }
    rows.sort((a, b) => a.summary.kind.localeCompare(b.summary.kind) || a.summary.id.localeCompare(b.summary.id));
    return { mode: source, rows };
  }

  async function find(kind, id) {
    const { rows } = await snapshot();
    const row = rows.find(row => row.summary.kind === kind && row.summary.id === id);
    if (!row) throw new Error('没有找到对应资料。请先搜索并使用结果中的 kind 和 id。');
    return row;
  }

  async function componentFiles(record, publishedRecord) {
    const files = new Map();
    if (!allowsLocalSource(record, publishedRecord)) {
      // The upstream restriction still applies to local archives. The adapted
      // motion preview ships with Ilia and is read from its original bundle.
      const [, builtins] = await seeds();
      const adaptation = builtins.find(item => item.id === record.id && item.builtin);
      for (const file of array(adaptation?.files)) files.set(file.name, file.content);
      if (typeof record.prompt === 'string' && record.prompt) files.set('PROMPT.md', record.prompt);
      return files;
    }
    const filePackage = typeof record.filePackage === 'string' && packageId.test(record.filePackage)
      ? await readLocal(root, ['packages', record.filePackage + '.json']) ??
        (allowsComponentSource(record) ? await readLocal(publicDir, ['component-packages', record.filePackage + '.json']) : null)
      : null;
    for (const file of [...array(record.files), ...array(filePackage?.files)]) {
      if (file && typeof file.name === 'string' && typeof file.content === 'string') files.set(file.name, file.content);
    }
    if (typeof record.prompt === 'string' && record.prompt && !files.has('PROMPT.md')) files.set('PROMPT.md', record.prompt);
    // Legacy exports may only retain a pointer to the snapshot on disk.
    const folder = record.id.replace(/[^a-z\d_-]/gi, '_');
    if (!packageId.test(folder)) return files;
    const pointers = [...array(record.files), ...array(record.sourceFiles)];
    if (!pointers.some(source => typeof source?.name === 'string' && !files.has(source.name))) return files;
    const manifest = await readLocal(root, ['components', folder, 'manifest.json']);
    if (manifest?.id !== record.id) return files;
    for (const source of pointers) {
      const name = source?.name;
      if (typeof name !== 'string' || /^[.]|[/\\:\x00-\x1f]/u.test(name) || files.has(name)) continue;
      const content = await readLocal(root, ['components', folder, name], 'text');
      if (content !== null) files.set(name, content);
    }
    return files;
  }

  return {
    async search({ query, kind, category, source, offset, limit, searchBody, includeArchived = false }) {
      const { mode, rows } = await snapshot();
      const prepared = prepareSearchQuery(query);
      const categoryKey = normalizeSearchText(category);
      const sourceKey = sourceFilter(source);
      const ranked = rows.filter(({ summary }) => (!kind || summary.kind === kind) && (includeArchived || !summary.archived))
        .map(row => ({ row, score: rankLocal(row, prepared, categoryKey, sourceKey, searchBody) }))
        .filter(({ score }) => score >= 0)
        .sort((a, b) => b.score - a.score || (kind === 'component' ? compareComponentTitles(
          a.row.publishedRecord || a.row.record, b.row.publishedRecord || b.row.record,
        ) : 0));
      return { mode, ...resultPage(ranked.map(({ row }) => row.summary), offset, limit) };
    },
    async record(kind, id, { includeLocalReference = false } = {}) {
      const { summary, record, publishedRecord, reference } = await find(kind, id);
      const files = kind === 'component' ? [...(await componentFiles(record, publishedRecord)).keys()] : [];
      if (publishedRecord) {
        return { summary: includeLocalReference ? { ...summary, ...reference } : summary, record: publishedMcpRecord(publishedRecord, summary),
          files: files.filter(name => !containsWebLink.test(name)) };
      }
      if (kind === 'component' && !allowsLocalSource(record, publishedRecord)) {
        const { files: inlineFiles, sourceFiles, filePackage, ...metadata } = record;
        return { summary, record: metadata, files };
      }
      return { summary, record, files };
    },
    async file(id, name) {
      const { record, publishedRecord, summary } = await find('component', id);
      const files = await componentFiles(record, publishedRecord);
      if (files.has(name)) return files.get(name);
      if (name !== 'PROMPT.md' && !allowsLocalSource(record, publishedRecord)) {
        const detail = summary.detailUrl ? ` ${summary.detailUrl}` : '';
        throw new Error(`source_restricted：请从 Ilia 组件详情查看来源和许可。${detail}`);
      }
      throw new Error('未找到该文件。请从组件详情中的 files 选择原始文件名。');
    },
    async overview() {
      const { mode, rows } = await snapshot();
      const counts = Object.fromEntries(kinds.map(kind => [kind, 0]));
      for (const { summary } of rows) {
        if (!summary.archived) counts[summary.kind] += 1;
      }
      return { mode, counts, previewOrigin: origin, publicOrigin };
    },
  };
}

function websiteOrigin(value) {
  const url = new URL(value || 'http://127.0.0.1:4318');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) {
    throw new Error('ILIACACHE_PUBLIC_BASE_URL 必须是公开站点的 HTTP(S) origin。');
  }
  return url.origin;
}

function publishedSummary(record, origin, source = 'public_catalog') {
  const detailUrl = new URL(record.path, origin).href;
  return {
    id: record.id,
    kind: 'component',
    source,
    archived: false,
    title: record.title,
    description: record.description,
    category: record.category,
    tags: record.tags,
    sourceAuthor: record.sourceAuthor || null,
    upstreamUrl: null,
    detailUrl,
    preview: { kind: 'website_url', url: detailUrl },
    resourceUri: 'ilia-cache://records/component/id-' + encodeURIComponent(record.id),
  };
}

function publishedMcpRecord(entry, { detailUrl, preview }) {
  const {
    id, title, originalName, description, category, tags, sourceAuthor, sourceName,
    collectionSource, sourcePageKind, sourcePolicy, license, prompt, path, files,
  } = entry;
  return {
    id, title, originalName, description, category, tags, sourceAuthor, sourceName,
    collectionSource, sourcePageKind, sourcePolicy, path, files, detailUrl, preview,
    license: containsWebLink.test(license) ? '详见 Ilia 组件详情的许可说明' : license,
    ...(prompt && !containsWebLink.test(prompt) ? { prompt } : {}),
  };
}

export function createPublicCatalog({ baseUrl = process.env.ILIACACHE_PUBLIC_BASE_URL } = {}) {
  const origin = websiteOrigin(baseUrl);
  const siteUrl = route => new URL(route, origin).href;
  const mode = 'public_catalog';
  async function find(kind, id) {
    const { byId } = await publishedSnapshot();
    const record = kind === 'component' && byId.get(id);
    if (!record) throw new Error('not_found：公开目录中没有该组件。请先搜索并使用结果中的 id。');
    return record;
  }

  return {
    async search({ query, kind, category, source, offset, limit }) {
      const { components } = await publishedSnapshot();
      const prepared = prepareSearchQuery(query);
      const categoryKey = normalizeSearchText(category);
      const sourceKey = sourceFilter(source);
      const ranked = !kind || kind === 'component' ? components
        .filter(record => (!categoryKey || normalizeSearchText(record.category) === categoryKey) &&
          (!sourceKey || sourceFilter(record.sourceName) === sourceKey))
        .map(record => ({ record, score: rankPublished(record, prepared) }))
        .filter(row => row.score >= 0)
        .sort((a, b) => b.score - a.score || compareComponentTitles(a.record, b.record)) : [];
      const page = resultPage(ranked, offset, limit);
      return { mode, ...page, items: page.items.map(({ record }) => publishedSummary(record, origin)) };
    },
    async record(kind, id) {
      const record = await find(kind, id);
      const summary = publishedSummary(record, origin);
      return { summary, record: publishedMcpRecord(record, summary), files: record.files };
    },
    async file(id, name) {
      const record = await find('component', id);
      if (!allowsComponentSource(record)) {
        throw new Error(`source_restricted (${record.sourcePolicy})：请从 Ilia 组件详情查看来源和许可 ${siteUrl(record.path)}`);
      }
      if (!record.files.includes(name)) throw new Error('未找到该文件。请从组件详情中的 files 选择原始文件名。');
      const bundle = await readLocal(publicDir, ['component-packages', record.id + '.json']);
      return projectPublicComponentBundle(record, bundle).files.find(file => file.name === name).content;
    },
    async overview() {
      const { version, components } = await publishedSnapshot();
      return { mode, version, counts: { component: components.length }, previewOrigin: origin };
    },
    async topics() {
      const { topics } = await publishedSnapshot();
      return topics.map(({ path, examples, ...topic }) => ({
        ...topic, url: siteUrl(path), examples: examples.map(anchor => siteUrl(path + '#' + anchor)),
      }));
    },
  };
}
