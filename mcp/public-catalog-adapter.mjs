import { compareComponentTitles, componentSearchFields, createSearchRanker, normalizeSearchText, prepareSearchQuery } from '../public/component-search.mjs';
import { searchCatalog, searchDocument, searchTerms } from '../lib/catalog-search.mjs';

const containsWebLink = /https?:\/\/|\bwww\.|(?:^|[\s("'\x60])\/\/[^\s.]+\./iu;
const sourceFilter = value => typeof value === 'string' ? value.normalize('NFKC').trim().toLowerCase() : '';
const rankers = new WeakMap();
function rankPublished(record, query) {
  let rank = rankers.get(record);
  if (!rank) {
    rank = createSearchRanker(componentSearchFields(record), () => record.prompt);
    rankers.set(record, rank);
  }
  return rank(query);
}

export function websiteOrigin(value) {
  const url = new URL(value || 'http://127.0.0.1:4318');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) {
    throw new Error('ILIACACHE_PUBLIC_BASE_URL 必须是公开站点的 HTTP(S) origin。');
  }
  return url.origin;
}

export function publishedSummary(record, origin, source = 'public_catalog') {
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

export function publishedMcpRecord(entry, { detailUrl, preview }) {
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


const mode = 'public_catalog';

function matchingVersion(actual, expected) {
  if (expected && String(actual) !== expected) {
    throw new Error('release_changed：目录已更新，请重新搜索后再查看。');
  }
}

/** Adapt a permission-reviewed release to the same tools used by standalone MCP. */
export function createPublishedCatalog({ baseUrl, snapshot, retrieve, lookup, readFile }) {
  const origin = websiteOrigin(baseUrl);
  const siteUrl = route => new URL(route, origin).href;

  async function find(kind, id, expected) {
    const found = await lookup(kind, id);
    if (!found) throw new Error('not_found：没有找到已公开的资源，请重新搜索。');
    matchingVersion(found.version, expected);
    return found;
  }

  return {
    async search({ query, kind, category, source, offset = 0, limit = 10 }) {
      const { components } = await snapshot();
      const prepared = prepareSearchQuery(query);
      const categoryKey = normalizeSearchText(category);
      const sourceKey = sourceFilter(source);
      const ranked = !kind || kind === 'component' ? components
        .filter(record => (!categoryKey || normalizeSearchText(record.category) === categoryKey) &&
          (!sourceKey || sourceFilter(record.sourceName) === sourceKey))
        .map(record => ({ record, score: rankPublished(record, prepared) }))
        .filter(row => row.score >= 0)
        .sort((a, b) => b.score - a.score || compareComponentTitles(a.record, b.record)) : [];
      const end = Math.min(offset + limit, ranked.length);
      return { mode, total: ranked.length, nextOffset: end < ranked.length ? end : null,
        items: ranked.slice(offset, end).map(({ record }) => publishedSummary(record, origin)) };
    },
    async searchResources(request) {
      const { version, candidates } = await retrieve({
        terms: searchTerms(request.intent), kind: request.kind, category: request.category,
        source: request.source, id: request.intent, limit: 250,
      });
      return searchCatalog({ version, candidates }, request);
    },
    async record(kind, id, { releaseId } = {}) {
      const { version, resource } = await find(kind, id, releaseId);
      const record = resource.record;
      if (kind === 'component' || kind === 'sound') {
        const summary = publishedSummary(record, origin);
        return { summary, record: publishedMcpRecord(record, summary), files: record.files, evidence: resource.document?.evidence,
          releaseId: String(version) };
      }
      const { document } = resource;
      const published = document || searchDocument({ ...record, kind });
      const detailUrl = published.detailPath && siteUrl(published.detailPath);
      // Non-component records are rebuilt from the DB projection, never local data.
      const summary = {
        id, kind, source: 'public_catalog', archived: false, title: published.title,
        description: published.description, category: published.category, tags: [], sourceAuthor: null,
        upstreamUrl: null, preview: detailUrl ? { kind: 'website_url', url: detailUrl } : null,
        ...(detailUrl ? { detailUrl } : {}),
        resourceUri: 'ilia-cache://records/' + kind + '/id-' + encodeURIComponent(id),
      };
      return { summary, record: {
        id, kind, title: published.title, category: published.category, description: published.description,
        path: published.detailPath, sourcePolicy: published.sourcePolicy,
        sourcePageUrl: record.sourcePageUrl || record.sourceUrl || record.url || undefined,
      }, files: [], evidence: published.evidence, releaseId: String(version) };
    },
    async file(id, name, { releaseId } = {}) {
      const { resource } = await find('component', id, releaseId);
      const record = resource.record;
      if (record.sourcePolicy !== 'bundled-source') {
        throw new Error(`source_restricted (${record.sourcePolicy})：请从 Ilia 组件详情查看来源和许可 ${siteUrl(record.path)}`);
      }
      if (!record.files.includes(name)) throw new Error('未找到该文件。请从组件详情中的 files 选择原始文件名。');
      const result = await readFile('component', id, name);
      if (!result) throw new Error('source_restricted：此文件当前未获准读取。');
      matchingVersion(result.version, releaseId);
      return result.file.content;
    },
    async overview() {
      const { version, components } = await snapshot();
      return { mode, version, counts: { component: components.length }, previewOrigin: origin };
    },
    async topics() {
      const { topics } = await snapshot();
      return (topics || []).map(({ path, examples, ...topic }) => ({
        ...topic, url: siteUrl(path), examples: examples.map(anchor => siteUrl(path + '#' + anchor)),
      }));
    },
  };
}
