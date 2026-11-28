import { SITE_CATEGORIES, sitePreviewRank, validPublicWebUrl } from './catalog.mjs';
import { compareFavoriteNames } from './favorite-button.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

export const WEBSITE_FILTERS = ['全部', '有源码', '有提示词', '免费', '有收藏'];
export const WEBSITE_SORTS = [['name', '名称 A–Z'], ['new', '最新添加'], ['default', '收藏顺序']];
export const websiteTitle = site => site.name || site.title || site.domain;

const cleanSummary = text => String(text || '').replace(/；?本次原站[^。]*[。]?/g, '')
  .replace(/，项目内容待复核[。]?/g, '').replace(/，内容需打开复核[。]?/g, '')
  .replace(/原收藏是一处/, '').replace(/原笔记记录为/, '');

export function websiteCategories(sites) {
  return [...new Set([...SITE_CATEGORIES, ...sites.map(site => site.category).filter(Boolean)])];
}

function websiteHasCases(site) {
  if (site.cases) return site.cases.length > 0;
  return (site.links || []).some(link => {
    const href = validPublicWebUrl(link.url);
    if (!href) return false;
    const { pathname, search } = new URL(href);
    return pathname !== '/' || Boolean(search);
  });
}

export function readWebsiteFilters(params, sites) {
  const category = params.get('category') || '';
  const filter = params.get('filter') || WEBSITE_FILTERS[0];
  const order = params.get('sort') || WEBSITE_SORTS[0][0];
  return {
    query: (params.get('q') || '').slice(0, 200),
    category: websiteCategories(sites).includes(category) ? category : '',
    filter: WEBSITE_FILTERS.includes(filter) ? filter : WEBSITE_FILTERS[0],
    order: WEBSITE_SORTS.some(([value]) => order === value) ? order : WEBSITE_SORTS[0][0],
    layout: params.get('layout') === 'deck' ? 'deck' : 'list',
    selected: params.get('site') || '',
  };
}

export function filterWebsites(sites, { query = '', category = '', filter = '全部', order = 'name', view = 'all', favoritesFirst = false } = {}) {
  const term = query.trim().toLocaleLowerCase();
  const result = sites.filter(site => {
    if ((view === 'favorites' && !site.favorite) || (view === 'cases' && !websiteHasCases(site))) return false;
    if (category && category !== site.category) return false;
    if (filter === '有源码' && !site.gets?.includes('源码')) return false;
    if (filter === '有提示词' && !site.gets?.includes('提示词')) return false;
    if (filter === '免费' && site.cost !== '免费') return false;
    if (filter === '有收藏' && !websiteHasCases(site)) return false;
    if (!term) return true;
    const related = site.members || site.links || [];
    return [websiteTitle(site), site.domain, site.description, site.finds, site.use, ...(site.tags || []),
      ...related.flatMap(item => [item.name || item.title, item.note, item.url])].join(' ').toLocaleLowerCase().includes(term);
  });
  if (favoritesFirst && order === 'name') return result.sort((a, b) => compareFavoriteNames(a, b, websiteTitle));
  return result.sort((a, b) => sitePreviewRank(a) - sitePreviewRank(b) ||
    (order === 'new' ? (b.created || '').localeCompare(a.created || '') :
      order === 'name' ? websiteTitle(a).localeCompare(websiteTitle(b)) : 0));
}

function previewAction(site) {
  return `<div class="site-row-actions"><button type="button" data-web-preview="${escape(site.id)}" aria-label="预览网站 ${escape(websiteTitle(site))}" title="预览网站">↗</button></div>`;
}

export function canPreviewPublicWebsite(source, currentUrl) {
  const url = new URL(source);
  const current = new URL(currentUrl);
  return url.protocol === 'https:' && url.origin !== current.origin;
}

export function renderWebsiteRows(sites, { selected = '', actions = () => '', tooltipId = '', preview = false } = {}) {
  if (!sites.length) return '<div class="empty">没有匹配的网站，换个关键词试试。</div>';
  return sites.map(site => {
    const { id, url, category, cost } = site;
    const title = websiteTitle(site);
    const tooltip = tooltipId ? ' aria-describedby="' + escape(tooltipId) + '"' : '';
    return `<article class="resource-row${id === selected ? ' selected' : ''}" data-site="${escape(id)}">
      <span class="resource-icon">${escape(title.slice(0, 1))}</span>
      <div class="resource-body"><h3><a class="site-link" href="${escape(validPublicWebUrl(url))}" target="_blank" rel="noopener noreferrer" data-home="${escape(id)}"${tooltip}>${escape(title)} <span class="link-arrow">↗</span></a></h3>
      <p class="site-finds">${escape(cleanSummary(site.finds || site.description))}</p><p class="site-use">${escape(cleanSummary(site.use))}</p>
      <div class="metadata"><span>${escape(category)}</span><span>·</span><span>${escape(cost === '待核实' ? '' : cost)}</span></div></div>${preview ? previewAction(site) : actions(site)}</article>`;
  }).join('');
}

export function renderWebsiteCards(sites, { screenshot, actions = () => '' } = {}) {
  return `<div class="website-card-grid">${sites.map(site => {
    const title = websiteTitle(site);
    const url = escape(validPublicWebUrl(site.url));
    const image = screenshot?.(site);
    const preview = image
      ? `<img loading="lazy" src="${escape(image)}" alt="${escape(title)} 首页">`
      : `<div class="case-media-empty"><span aria-hidden="true">↗</span><p>${escape(site.domain)}</p></div>`;
    return `<article class="website-card"><div class="favorite-surface"><a href="${url}" target="_blank" rel="noopener noreferrer">${preview}</a>${actions(site)}</div>
      <div><h3><a href="${url}" target="_blank" rel="noopener noreferrer">${escape(title)}</a></h3>
      <p>${escape(site.finds || site.description)}</p><span>${escape(site.category)}</span>
      <button data-web-preview="${escape(site.id)}" type="button">预览网站 ↗</button></div></article>`;
  }).join('')}</div>`;
}

export function renderWebsiteLayoutSwitch(layout) {
  return `<div class="view-switch"><button type="button" data-layout="list" aria-pressed="${layout === 'list'}">☷ 列表</button><button type="button" data-layout="deck" aria-pressed="${layout === 'deck'}">▱ 卡片</button></div>`;
}

export function renderWebsiteInspector(site, { actions = () => '', canFrame = () => false } = {}) {
  const source = site && validPublicWebUrl(site.url);
  if (!source) return '';
  const title = websiteTitle(site);
  const label = escape(title + ' 网站预览');
  const sourceLink = `<a href="${escape(source)}" target="_blank" rel="noopener noreferrer">打开原站 ↗</a>`;
  const frame = canFrame(source)
    ? `<iframe class="site-live" title="${label}" src="${escape(source)}" sandbox="allow-scripts" referrerpolicy="no-referrer" loading="lazy"></iframe>`
    : `<div class="site-embed-fallback"><p>在原站查看预览</p>${sourceLink}</div>`;
  const links = [...new Map((site.links || []).flatMap(link => {
    const url = validPublicWebUrl(link.url);
    return url && url !== source ? [[url, link.title]] : [];
  })).entries()];
  return `<div class="site-preview-heading"><h2>${escape(title)}</h2><div class="site-preview-actions">${sourceLink}</div></div>
    <div class="site-live-wrap favorite-surface">${frame}${actions(site)}</div>
    ${links.length ? `<ul class="website-source-links">${links.map(([url, name]) => `<li><a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(name)} ↗</a></li>`).join('')}</ul>` : ''}`;
}

export function renderWebsiteDirectory(sites, options) {
  const { state, rows, path, actions, canFrame } = options;
  const { query, category, filter, order, layout, selected } = state;
  const shown = rows.find(site => site.id === selected) || rows[0];
  const isDeck = layout === 'deck';
  return `<div class="page-heading"><div><h1>网站</h1></div><span class="collection-count">${sites.length}</span></div>
    <form class="searchbar" action="${escape(path)}" method="get"><span aria-hidden="true">⌕</span><input id="website-directory-search" name="q" data-command-search aria-label="搜索收藏" placeholder="搜索名称、风格、组件或笔记…" value="${escape(query)}"><kbd>⌘ K</kbd></form>
    <div class="filterbar"><div data-website-categories><nav aria-label="按用途浏览">${['', ...websiteCategories(sites)].map(name =>
      `<button type="button" data-category="${escape(name)}" aria-pressed="${name === category}"${name === category ? ' class="active"' : ''}>${escape(name || '全部用途')}</button>`).join('')}</nav></div>
    <div class="filters">${WEBSITE_FILTERS.map(name => `<button type="button" data-filter="${name}" aria-pressed="${name === filter}"${name === filter ? ' class="active"' : ''}>${name}</button>`).join('')}</div>
    <label class="sort-label">排序 <select aria-label="排序" data-website-sort>${WEBSITE_SORTS.map(([value, name]) => `<option value="${value}"${value === order ? ' selected' : ''}>${name}</option>`).join('')}</select></label></div>
    <div class="library-layout${isDeck ? ' website-grid-mode' : ''}"><section class="resource-index" aria-label="收藏列表"><div class="list-head"><span data-website-count aria-live="polite">${rows.length} 个网站</span></div>${renderWebsiteLayoutSwitch(layout)}
    <div data-website-deck${isDeck ? '' : ' hidden'}>${isDeck ? renderWebsiteCards(rows, { actions }) : ''}</div>
    <div data-website-list${isDeck ? ' hidden' : ''}>${isDeck ? '' : renderWebsiteRows(rows, { selected: shown?.id, preview: true })}</div></section>
    <aside class="inspector" aria-label="网站预览" aria-live="polite"${isDeck ? ' hidden' : ''}>${isDeck ? '' : renderWebsiteInspector(shown, { actions, canFrame })}</aside></div>`;
}
