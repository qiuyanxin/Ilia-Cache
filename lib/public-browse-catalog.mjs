import { domainOf, groupSites } from '../public/catalog.mjs';
import { isComponentRecord } from '../public/component-taxonomy.mjs';
import { isPageRecord } from '../public/page-taxonomy.mjs';
import { publicUrl } from './public-catalog.mjs';

const recordId = /^[a-z0-9][a-z0-9_-]{0,120}$/;
const pageBriefKinds = new Set(['original', 'implementation-task']);

const text = (value, limit = 180) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
const href = value => typeof value === 'string' ? publicUrl(value)?.href : undefined;
const tags = values => Array.isArray(values)
  ? [...new Set(values.map(value => text(value, 80)).filter(Boolean))].slice(0, 30)
  : [];

function projectWebsite(site, summary) {
  const reviewedHome = href(summary?.homeUrl);
  const checkUrl = href(summary?.sourceUrl);
  const date = text(summary?.checkedAt, 10);
  const created = text(site.created, 10);
  return {
    id: site.id,
    domain: site.domain,
    title: text(summary?.name) || text(site.name) || site.domain,
    url: reviewedHome && domainOf(reviewedHome) === site.domain ? reviewedHome : site.url,
    category: text(summary?.category, 100) || text(site.category, 100) || '未分类',
    tags: tags(site.tags),
    description: text(summary?.description, 600),
    finds: text(summary?.finds, 400),
    use: text(summary?.use, 400),
    gets: text(summary?.gets, 120),
    cost: text(summary?.cost, 120),
    created: /^\d{4}-\d{2}-\d{2}$/.test(created) ? created : '',
    verification: checkUrl ? {
      sourceUrl: checkUrl,
      checkedAt: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '',
      note: text(summary?.verification, 400),
    } : null,
    links: site.members.map(row => ({
      id: row.id,
      title: text(row.displayTitle) || text(row.pageTitle) || text(row.name) || site.domain,
      url: row.url,
    })),
  };
}

function projectPage(row) {
  const documentedSource = href(row.sourcePageUrl);
  const declaredPrimary = row.sourcePageKind === 'primary' ? documentedSource : undefined;
  const originalSource = ['original', 'primary'].includes(row.primarySourceKind) ? href(row.primarySourceUrl) : undefined;
  const primarySource = row.sourceLinkAvailable === false ? undefined : declaredPrimary || originalSource;
  const declaredCollection = row.sourcePageKind === 'collection' ? documentedSource : undefined;
  const collectionSource = text(row.collectionSource?.name);
  const hasCollectionSource = row.sourcePageKind === 'collection' || Boolean(collectionSource);
  const title = text(row.name) || text(row.originalName);
  if (!title) return null;
  return {
    id: row.id,
    title,
    originalName: text(row.originalName),
    url: row.url,
    category: text(row.pageCategory, 100) || '内容与行业',
    sourceCategory: text(row.sourceCategory, 100),
    description: text(row.description, 600),
    tags: tags(row.tags),
    sourceName: text(row.sourceShort) || domainOf(row.url),
    sourceAuthor: text(row.primarySourceAuthor),
    collectionSource,
    sourcePageUrl: primarySource || declaredCollection || row.url,
    sourcePageKind: primarySource ? 'primary' : hasCollectionSource ? 'collection' : 'unresolved',
    access: text(row.access, 80),
    license: text(row.license, 300) || 'unknown',
    promptKind: pageBriefKinds.has(row.promptKind) ? row.promptKind : null,
  };
}

/**
 * 使用版本库中的 public/seed.json 和 public/site-summaries.json。
 * 网站和 MCP 共用这份发布投影。不要把用户本机资料或浏览器状态作为输入。
 * 页面 promptKind 仅描述参考文案的来源。打开示例请使用记录中的原站链接。
 */
export function buildPublicBrowseCatalog(seed, siteSummaries) {
  if (!Array.isArray(seed) || !siteSummaries || typeof siteSummaries !== 'object' || Array.isArray(siteSummaries)) {
    throw new TypeError('网站与页面目录需要已发布的种子数组和站点摘要对象。');
  }
  const websiteRows = [];
  const pages = [];
  const ids = new Set();
  for (const row of seed) {
    if (!row || row.archived || typeof row.id !== 'string' || !recordId.test(row.id) || ids.has(row.id) ||
        row.sourcePolicy || row.builtinNative || isComponentRecord(row)) continue;
    const url = href(row.url);
    if (!url) continue;
    if (isPageRecord(row)) {
      const page = projectPage({ ...row, url });
      if (!page) continue;
      pages.push(page);
    } else if (row.kind === '网站') {
      websiteRows.push({
        id: row.id,
        url,
        kind: row.kind,
        name: row.name,
        displayTitle: row.displayTitle,
        pageTitle: row.pageTitle,
        category: row.category,
        created: row.created,
        tags: tags(row.tags),
      });
    } else {
      continue;
    }
    ids.add(row.id);
  }
  const websites = groupSites(websiteRows).map(site => projectWebsite(
    site, Object.hasOwn(siteSummaries, site.domain) ? siteSummaries[site.domain] : null,
  ));
  return { version: 1, websites, pages };
}
