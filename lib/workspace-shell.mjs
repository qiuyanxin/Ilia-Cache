import { cardImage, cardPlaceholder, renderComponentCard } from '../public/component-card.mjs';
import { renderComponentDetailChrome, renderPreviewOrigin, renderComponentPrompt, renderComponentReferences } from '../public/component-detail-chrome.mjs';
import { renderComponentSourceContent, renderComponentSourcePanel } from '../public/component-source-panel.mjs';
import { describeComponentDirectoryResults, renderComponentDirectoryStatus, renderComponentFilterChoices, renderGroupedComponentFilters } from '../public/component-directory-controls.mjs';
import { icon } from '../public/icons.mjs';
import { renderDetailMediaStage, renderMotionDetailPreview, renderOfficialFramePreview, renderSoundSourcePreview } from '../public/component-detail-preview.mjs';

const headBlocks = ['head', 'theme', 'styles'];
const bodyBlocks = ['sidebar', 'topbar', 'fallback', 'entry'];
const blocks = [...headBlocks, ...bodyBlocks];
const attributeName = 'data-ilia-shell-attrs';
const escaped = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => escaped[character]);
}

function invalidTemplate(message) {
  return new Error('工作台模板插槽无效：' + message);
}

function plainObject(value, name, keys) {
  if (!value || typeof value !== 'object' ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new TypeError(name + ' 必须是普通对象。');
  }
  for (const key of Object.keys(value)) {
    if (keys && !keys.includes(key)) throw new TypeError(name + ' 含有未知字段 ' + key + '。');
  }
  return value;
}

function text(value, name) {
  if (typeof value !== 'string' || /[\u0000]/u.test(value)) {
    throw new TypeError(name + ' 必须是文本。');
  }
  return value;
}

function array(value, name) {
  if (!Array.isArray(value)) throw new TypeError(name + ' 必须是数组。');
  return value;
}

function pathUrl(value, name) {
  text(value, name);
  if (!value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020\u007f]/u.test(value) ||
      value.split(/[?#]/, 1)[0].split('/').some(segment => /^(?:\.|%2e){1,2}$/i.test(segment))) {
    throw new TypeError(name + ' 必须是站内绝对路径。');
  }
  return value;
}

function webUrl(value, name, { allowPath = true } = {}) {
  text(value, name);
  if (allowPath && value.startsWith('/')) return pathUrl(value, name);
  try {
    const url = new URL(value);
    if (/^https?:\/\//i.test(value) && !/[\\\u0000-\u0020\u007f]/u.test(value) &&
        ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) return url.href;
  } catch {}
  throw new TypeError(name + ' 必须是 HTTP 或 HTTPS 链接。');
}

function findBlocks(source) {
  const markers = [...source.matchAll(/<!--\s*ilia-shell:[\s\S]*?-->/g)];
  const regions = {};
  const expected = blocks.flatMap(name => [`<!--ilia-shell:${name}:start-->`, `<!--ilia-shell:${name}:end-->`]);
  if (markers.length !== expected.length || markers.some((match, index) => match[0] !== expected[index])) {
    throw invalidTemplate('内容插槽缺失、重复或顺序错误。');
  }
  blocks.forEach((name, index) => {
    const [start, end] = markers.slice(index * 2, index * 2 + 2);
    regions[name] = {
      start: start.index,
      end: end.index + end[0].length,
      inner: source.slice(start.index + start[0].length, end.index),
    };
  });
  for (const [tag, names] of [['head', headBlocks], ['body', bodyBlocks]]) {
    const opening = new RegExp(`<${tag}\\b[^>]*>`, 'i').exec(source);
    const closing = new RegExp(`</${tag}\\s*>`, 'i').exec(source);
    if (!opening || !closing || names.some(name =>
      regions[name].start < opening.index + opening[0].length || regions[name].end > closing.index)) {
      throw invalidTemplate('内容插槽不在对应的 ' + tag + ' 标签内。');
    }
  }
  return regions;
}

function findAttributes(source) {
  const regions = {};
  const tags = { root: 'html', library: 'main' };
  const marker = new RegExp(`\\s+${attributeName}\\s*=\\s*(['"])([^'"]+)\\1`, 'gi');
  const markup = /<(html|main)\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi;
  for (const opening of source.matchAll(markup)) {
    for (const match of opening[0].matchAll(marker)) {
      const key = match[2];
      if (!Object.hasOwn(tags, key) || tags[key] !== opening[1].toLowerCase() || Object.hasOwn(regions, key)) {
        throw invalidTemplate('属性插槽的位置无效或重复。');
      }
      const start = opening.index + match.index;
      regions[key] = { start, end: start + match[0].length };
    }
  }
  const attrOccurrences = source.match(new RegExp(`\\b${attributeName}\\b`, 'gi'))?.length;
  if (attrOccurrences !== 2 || !regions.root || !regions.library) {
    throw invalidTemplate('属性插槽缺失或格式错误。');
  }
  return regions;
}

function readAssetAttributes(content, tagName, attrName) {
  const tag = new RegExp(`<${tagName}\\b(?:[^"'<>]|"[^"]*"|'[^']*')*>`, 'gi');
  const attribute = new RegExp(`\\s${attrName}\\s*=\\s*(['"])([^'"]+)\\1`, 'gi');
  const assets = [];
  for (const markup of content.matchAll(tag)) {
    const matches = [...markup[0].matchAll(attribute)];
    if (matches.length !== 1) throw invalidTemplate(tagName + ' 必须有一个 ' + attrName + '。');
    const type = tagName === 'link' ? /\srel\s*=\s*(['"])stylesheet\1/i : /\stype\s*=\s*(['"])module\1/i;
    if (!type.test(markup[0])) throw invalidTemplate(tagName + ' 类型无效。');
    const match = matches[0];
    try {
      pathUrl(match[2], attrName);
    } catch {
      throw invalidTemplate(attrName + ' 不是站内路径。');
    }
    assets.push({ value: match[2], start: markup.index + match.index, length: match[0].length });
  }
  if (!assets.length) throw invalidTemplate('没有找到 ' + tagName + '。');
  return assets;
}

function parseTemplate(source) {
  if (typeof source !== 'string') throw new TypeError('工作台模板必须是文本。');
  const content = findBlocks(source);
  const attributes = findAttributes(source);
  const styles = readAssetAttributes(content.styles.inner, 'link', 'href');
  if (new Set(styles.map(style => style.value)).size !== styles.length) {
    throw invalidTemplate('样式路径重复。');
  }
  const entry = readAssetAttributes(content.entry.inner, 'script', 'src');
  if (entry.length !== 1) throw invalidTemplate('应有一个本机入口。');
  return { content, attributes, styles, entry: entry[0] };
}

/** Return the authored local assets after validating the shell's insertion points. */
export function inspectWorkspaceShell(source) {
  const { styles, entry } = parseTemplate(source);
  return { styles: styles.map(style => style.value), entry: entry.value };
}

/** Provide the same shell landmarks to hosts that render their own page content. */
export function inspectWorkspaceChrome(source) {
  const { content } = parseTemplate(source);
  return { theme: content.theme.inner, sidebar: content.sidebar.inner, topbar: content.topbar.inner };
}

/** Populate the native shell with links that work before the host's scripts load. */
export function renderWorkspaceChrome(fragments, config) {
  plainObject(config, '工作台导航', ['items', 'dock', 'home', 'search', 'breadcrumb', 'renderIcon']);
  const home = escapeHtml(pathUrl(config.home, 'chrome.home'));
  const search = escapeHtml(pathUrl(config.search, 'chrome.search'));
  const breadcrumb = escapeHtml(text(config.breadcrumb, 'chrome.breadcrumb'));
  if (typeof config.renderIcon !== 'function') throw new TypeError('工作台导航缺少图标渲染函数。');

  const items = array(config.items, 'chrome.items').map(item => {
    plainObject(item, 'chrome.items 项', ['id', 'label', 'href', 'icon', 'active', 'count']);
    if (typeof item.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(item.id) ||
        typeof item.icon !== 'string' || !/^[a-z][a-zA-Z0-9-]*$/.test(item.icon) || typeof item.active !== 'boolean' ||
        (item.count !== undefined && (!Number.isSafeInteger(item.count) || item.count < 0))) {
      throw new TypeError('工作台导航项无效。');
    }
    return {
      id: item.id,
      label: escapeHtml(text(item.label, 'chrome.items.label')),
      href: escapeHtml(pathUrl(item.href, 'chrome.items.href')),
      // Icons come from a trusted renderer supplied by the host.
      icon: config.renderIcon(item.icon),
      attrs: item.active ? ' aria-current="page"' : '',
      active: item.active,
      count: item.count ?? '',
    };
  });
  const side = items.map(({ id, label, href, icon, attrs, active, count }) =>
    `<a data-view="${id}" href="${href}" aria-label="${label}"${attrs}${active ? ' class="active"' : ''}><span>${icon}</span><span class="nav-label">${label}</span><small>${count}</small></a>`).join('');
  const dockItems = config.dock === undefined ? items : array(config.dock, 'chrome.dock').map(id => {
    const item = items.find(entry => entry.id === id);
    if (!item) throw new TypeError('快捷栏引用了未知导航项。');
    return item;
  });
  if (new Set(dockItems).size !== dockItems.length) throw new TypeError('快捷栏导航项重复。');
  const dock = dockItems.map(({ id, label, href, icon, attrs, active }) =>
    `<a data-dock="${id}" href="${href}" aria-label="${label}" data-selected="${active}"${attrs}>${icon}<span>${label}</span></a>`).join('');
  const sidebar = fragments.sidebar
    .replace(/(<a class="brand" href=")[^"]*(")/, (_, start, end) => start + home + end)
    .replace(/<span class="brand-sub">[^<]*<\/span>/, '')
    .replace(/<div class="workspace-label">[\s\S]*?<\/div>/,
      '<div class="workspace-label word-roll"><span>积累</span><span class="word-slot">灵感</span></div>')
    .replace(/(<nav\b[^>]*\bid="navigation"[^>]*>)[\s\S]*?(<\/nav>)/, (_, start, end) => start + side + end)
    .replace(/<div class="sidebar-bottom">[\s\S]*?(?=<\/aside>)/, '<div class="sidebar-bottom"></div>');
  const topbar = fragments.topbar.replace(/(<header\b[^>]*>)[\s\S]*?(<\/header>)/, (_, start, end) =>
    `${start}<span id="breadcrumb">${breadcrumb}</span><nav class="action-dock" aria-label="快捷操作">` +
    `<a data-dock="search" href="${search}" aria-label="搜索">${config.renderIcon('search')}<span>搜索</span></a>` +
    `${dock}</nav><div id="theme-controls" class="pull-cord-control"><div class="cord-window"></div></div>${end}`);
  if (!sidebar.includes(side) || !topbar.includes(dock)) throw invalidTemplate('工作台导航插槽缺失。');
  return { sidebar, topbar };
}

function renderStyles(content, styles, assetPrefix, extraStyles) {
  let result = content;
  if (assetPrefix !== undefined) {
    const prefix = assetPrefix === '' ? '' : pathUrl(assetPrefix, 'assetPrefix').replace(/\/$/, '');
    if (/[?#]/.test(prefix)) throw new TypeError('assetPrefix 不能带查询或锚点。');
    for (const { value, start, length } of [...styles].reverse()) {
      result = result.slice(0, start) + ' href="' + escapeHtml(prefix + value) + '"' + result.slice(start + length);
    }
  }
  if (extraStyles !== undefined) {
    for (const asset of array(extraStyles, 'extraStyles')) {
      result += '<link rel="stylesheet" href="' + escapeHtml(pathUrl(asset, 'extraStyles 项')) + '">';
    }
  }
  return result;
}

function renderRoot(attributes) {
  if (attributes === undefined) return '';
  const output = [];
  for (const [key, value] of Object.entries(plainObject(attributes, 'rootAttributes'))) {
    if (!/^data-[a-z][a-z0-9-]*$/.test(key) || ['data-theme', attributeName].includes(key)) {
      throw new TypeError('rootAttributes 只接受非保留的 data-* 属性。');
    }
    if (value === false) continue;
    output.push(value === true ? ' ' + key : ` ${key}="${escapeHtml(text(value, key))}"`);
  }
  return output.join('');
}

function renderHead(head) {
  plainObject(head, 'head', ['title', 'description', 'canonical', 'meta']);
  const content = ['<title>' + escapeHtml(text(head.title, 'head.title')) + '</title>'];
  if (head.description !== undefined) {
    content.push('<meta name="description" content="' + escapeHtml(text(head.description, 'head.description')) + '">');
  }
  if (head.canonical !== undefined) {
    content.push('<link rel="canonical" href="' + escapeHtml(webUrl(head.canonical, 'head.canonical', { allowPath: false })) + '">');
  }
  if (head.meta !== undefined) {
    for (const item of array(head.meta, 'head.meta')) {
      plainObject(item, 'head.meta 项', ['name', 'property', 'content']);
      const key = Object.hasOwn(item, 'name') ? 'name' : 'property';
      if (key === 'name' && Object.hasOwn(item, 'property')) throw new TypeError('meta 项只能有 name 或 property。');
      const label = escapeHtml(text(item[key], 'head.meta.' + key));
      const value = escapeHtml(text(item.content, 'head.meta.content'));
      content.push(`<meta ${key}="${label}" content="${value}">`);
    }
  }
  return content.join('');
}

function renderFallbackFilters(filters) {
  plainObject(filters, 'fallback.filters', ['action', 'query', 'category', 'source', 'categories', 'sources', 'categoryCounts', 'hideCategories', 'subcategory', 'subcategoryCounts']);
  const action = escapeHtml(pathUrl(filters.action, 'fallback.filters.action'));
  const query = escapeHtml(text(filters.query, 'fallback.filters.query'));
  const form = 'ilia-directory-filters';
  const counts = filters.categoryCounts === undefined ? undefined : plainObject(filters.categoryCounts, 'fallback.filters.categoryCounts');
  if (counts && Object.values(counts).some(count => !Number.isSafeInteger(count) || count < 0)) {
    throw new TypeError('目录分类计数无效。');
  }
  const options = (name, values, counts) => renderComponentFilterChoices(name,
    array(values, 'fallback.filters 选项').map(value => text(value, 'fallback.filters 选项值')),
    { selected: text(filters[name], 'fallback.filters.' + name), form, counts });
  const grouped = filters.subcategoryCounts !== undefined;
  const groupedMarkup = grouped ? renderGroupedComponentFilters({
    categoryCounts: counts,
    subcategoryCounts: plainObject(filters.subcategoryCounts, 'fallback.filters.subcategoryCounts'),
  }, filters, { form }) : '';
  return {
    grouped,
    categories: filters.hideCategories || grouped ? '' : `<nav class="component-categories" aria-label="组件分类"><small>组件</small>${options('category', filters.categories, counts)}</nav>`,
    form: `<form id="${form}" class="workspace-fallback-filters" method="get" action="${action}">
      <div class="workspace-fallback-search">
        <button type="submit" aria-label="筛选" title="筛选">${icon('search')}</button>
        <label><input id="ilia-search" type="search" name="q" value="${query}" aria-label="${filters.hideCategories ? '搜索音效' : '关键词'}" placeholder="${filters.hideCategories ? '搜索音效…' : '搜索'}"></label>
      </div>
      ${groupedMarkup}
      <div class="component-source-filters" role="group" aria-label="来源">${options('source', filters.sources)}</div>
    </form>`,
  };
}

function renderFallbackCards(cards) {
  const content = array(cards, 'fallback.cards').map(card => {
    plainObject(card, 'fallback.cards 项', [
      'id', 'href', 'title', 'description', 'category', 'source', 'sourceHref', 'sourceAuthor', 'previewHref', 'poster', 'ratio', 'placeholder', 'slots',
    ]);
    const title = text(card.title, 'fallback.cards.title');
    const sourceHref = card.sourceHref === undefined ? undefined
      : webUrl(card.sourceHref, 'fallback.cards.sourceHref', { allowPath: false });
    return renderComponentCard({
      id: text(card.id, 'fallback.cards.id'), title, description: text(card.description, 'fallback.cards.description'),
      category: text(card.category, 'fallback.cards.category'), source: text(card.source, 'fallback.cards.source'),
      href: pathUrl(card.href, 'fallback.cards.href'), sourceHref,
      previewHref: card.previewHref === undefined ? undefined : webUrl(card.previewHref, 'fallback.cards.previewHref', { allowPath: false }),
      sourceAuthor: card.sourceAuthor === undefined ? undefined : text(card.sourceAuthor, 'fallback.cards.sourceAuthor'),
      media: card.poster === undefined ? cardPlaceholder(card.placeholder)
        : cardImage(webUrl(card.poster, 'fallback.cards.poster'), title, card.ratio),
      slots: plainObject(card.slots, 'fallback.cards.slots', ['1', '2', '3']),
    });
  });
  return content.length ? '<div class="component-grid workspace-fallback-cards">' + content.join('') + '</div>' : '';
}

function renderDetailPreview(preview, title) {
  plainObject(preview, 'fallback.detail.preview', ['kind', 'url', 'poster', 'ratio', 'label']);
  if (preview.ratio !== undefined && (!Number.isFinite(preview.ratio) || preview.ratio <= 0)) throw new TypeError('预览比例无效。');
  switch (preview.kind) {
    case 'motion': {
      if (preview.ratio === undefined) throw new TypeError('动效预览缺少比例。');
      return renderMotionDetailPreview({ title, ratio: preview.ratio, poster: webUrl(preview.poster, 'fallback.detail.preview.poster') });
    }
    case 'image': {
      const url = escapeHtml(webUrl(preview.url, 'fallback.detail.preview.url'));
      return renderDetailMediaStage(`<img data-preview-media src="${url}" alt="${escapeHtml(title)}" referrerpolicy="no-referrer">`, preview);
    }
    case 'video': {
      const url = escapeHtml(webUrl(preview.url, 'fallback.detail.preview.url'));
      const poster = preview.poster === undefined ? '' : ` poster="${escapeHtml(webUrl(preview.poster, 'fallback.detail.preview.poster'))}"`;
      return renderDetailMediaStage(`<video data-preview-media class="component-full-video" controls muted playsinline preload="none" src="${url}"${poster} aria-label="${escapeHtml(title)}"></video>`, preview);
    }
    case 'frame':
      return renderOfficialFramePreview({ title, url: webUrl(preview.url, 'fallback.detail.preview.url', { allowPath: false }) });
    case 'sound':
      return preview.url ? renderSoundSourcePreview(webUrl(preview.url, 'fallback.detail.preview.url', { allowPath: false }))
        : '<div class="component-static-preview">' + cardPlaceholder('sound') + '</div>';
    case 'source':
      return '<div class="component-static-preview"><span class="component-source-preview">' +
        escapeHtml(text(preview.label, 'fallback.detail.preview.label')) + '</span></div>';
    default:
      throw new TypeError('组件预览类型无效。');
  }
}

function renderFallbackDetailPanel(detail, title, origin) {
  const panel = detail.panel;
  if (panel === undefined) return renderDetailPreview(detail.preview, title);
  plainObject(panel, 'fallback.detail.panel', ['kind', 'author', 'license', 'prompt', 'download', 'files']);
  if (panel.kind === 'prompt') {
    return renderComponentPrompt({ value: text(panel.prompt, 'fallback.detail.panel.prompt') });
  }
  if (panel.kind === 'references') {
    return renderComponentReferences({
      source: origin, author: text(panel.author, 'fallback.detail.panel.author'), license: text(panel.license, 'fallback.detail.panel.license'),
      media: ['image', 'video'].includes(detail.preview.kind) ? renderDetailPreview(detail.preview, title) : '',
    });
  }
  if (panel.kind === 'source') {
    const download = pathUrl(panel.download, 'fallback.detail.panel.download');
    const names = array(panel.files, 'fallback.detail.panel.files').map(name => text(name, '源码文件'));
    return renderComponentSourcePanel(download, renderComponentSourceContent({ names, state: 'static' }));
  }
  throw new TypeError('组件详情页签无效。');
}

function renderFallbackDetail(id, title, description, detail) {
  plainObject(detail, 'fallback.detail', ['category', 'source', 'back', 'backLabel', 'preview', 'tabs', 'panel']);
  const source = plainObject(detail.source, 'fallback.detail.source', ['href', 'label']);
  const origin = {
    href: webUrl(source.href, 'fallback.detail.source.href', { allowPath: false }),
    label: text(source.label, 'fallback.detail.source.label'),
  };
  const chrome = renderComponentDetailChrome({
    title,
    headingId: 'ilia-ssr-title',
    category: text(detail.category, 'fallback.detail.category'),
    description: description === undefined ? undefined : text(description, 'fallback.description'),
    back: pathUrl(detail.back, 'fallback.detail.back'),
    backLabel: detail.backLabel === undefined ? undefined : text(detail.backLabel, 'fallback.detail.backLabel'),
    source: origin,
  });
  const tabs = detail.tabs === undefined ? '<span class="component-static-tab active">预览</span>' :
    array(detail.tabs, 'fallback.detail.tabs').map(tab => {
      plainObject(tab, 'fallback.detail.tabs 项', ['name', 'href', 'active']);
      const name = escapeHtml(text(tab.name, 'fallback.detail.tabs.name'));
      const href = escapeHtml(pathUrl(tab.href, 'fallback.detail.tabs.href'));
      return `<a class="component-static-tab${tab.active ? ' active' : ''}" data-detail-tab="${name}" href="${href}"${tab.active ? ' aria-current="page"' : ''}>${name}</a>`;
    }).join('');
  return `<main class="workspace-fallback workspace-fallback-detail"${id}>
    <article class="component-detail-panel" aria-labelledby="ilia-ssr-title">
      ${chrome}
      <nav class="detail-tabs" aria-label="组件详情">${tabs}</nav>
      <div class="component-static-detail-preview">${renderFallbackDetailPanel(detail, title, origin)}${detail.panel === undefined ? renderPreviewOrigin(origin) : ''}</div>
    </article>
  </main>`;
}

function renderFallback(fallback) {
  plainObject(fallback, 'fallback', ['id', 'title', 'description', 'image', 'links', 'filters', 'cards', 'detail', 'directoryResultCount', 'trustedMarkup']);
  const id = fallback.id === undefined ? '' : ' id="' + escapeHtml(text(fallback.id, 'fallback.id')) + '"';
  const rawTitle = text(fallback.title, 'fallback.title');
  if (fallback.trustedMarkup !== undefined) {
    // Use markup from a shared renderer that escapes catalog fields.
    return `<main${id}>${text(fallback.trustedMarkup, 'fallback.trustedMarkup')}</main>`;
  }
  if (fallback.detail !== undefined) return renderFallbackDetail(id, rawTitle, fallback.description, fallback.detail);
  const title = escapeHtml(rawTitle);
  const heading = '<h1>' + title + '</h1>';
  const gallery = fallback.cards !== undefined;
  const filters = fallback.filters === undefined ? undefined : renderFallbackFilters(fallback.filters);
  const content = gallery ? [
    '<main class="workspace-fallback workspace-fallback-gallery"' + id + '>',
    '<div class="page-heading">' + heading + '</div><div class="component-layout' + (fallback.filters?.hideCategories ? ' sound-library-layout' : filters?.grouped ? ' grouped-component-layout' : '') + '">' + (filters?.categories || '') + '<section>',
  ] : ['<main class="workspace-fallback"' + id + '>' + heading];
  if (filters) {
    if (!gallery) content.push(filters.categories);
    content.push(filters.form);
  }
  if (fallback.description !== undefined) {
    content.push('<p>' + escapeHtml(text(fallback.description, 'fallback.description')) + '</p>');
  }
  if (fallback.directoryResultCount !== undefined) {
    if (!gallery || !filters || !Number.isSafeInteger(fallback.directoryResultCount) || fallback.directoryResultCount < 0) {
      throw new TypeError('目录结果数要求有效的组件目录和筛选表单。');
    }
    const status = describeComponentDirectoryResults(fallback.directoryResultCount, { ...fallback.filters, entity: fallback.filters.hideCategories ? '音效' : undefined });
    content.push(renderComponentDirectoryStatus(status, { clearHref: fallback.filters.action }));
  }
  if (fallback.image !== undefined) {
    const { src, alt } = plainObject(fallback.image, 'fallback.image', ['src', 'alt']);
    content.push(`<img src="${escapeHtml(webUrl(src, 'fallback.image.src'))}" alt="${escapeHtml(text(alt, 'fallback.image.alt'))}" style="max-width:100%;height:auto" referrerpolicy="no-referrer">`);
  }
  if (gallery) content.push(renderFallbackCards(fallback.cards));
  if (fallback.links !== undefined) {
    const links = array(fallback.links, 'fallback.links').map(item => {
      const { href, label, external } = plainObject(item, 'fallback.links 项', ['href', 'label', 'external']);
      if (external !== undefined && typeof external !== 'boolean') {
        throw new TypeError('fallback.links.external 必须是布尔值。');
      }
      const attributes = external ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<li><a href="${escapeHtml(webUrl(href, 'fallback.links.href'))}"${attributes}>${escapeHtml(text(label, 'fallback.links.label'))}</a></li>`;
    });
    if (links.length) content.push('<ul>' + links.join('') + '</ul>');
  }
  return content.join('') + (gallery ? '</section></div></main>' : '</main>');
}

function fill(source, replacements) {
  let start = 0;
  let rendered = '';
  for (const { region, value } of replacements.sort((a, b) => a.region.start - b.region.start)) {
    rendered += source.slice(start, region.start) + value;
    start = region.end;
  }
  return rendered + source.slice(start);
}

/** Fill a native workspace document from plain data. Omitted values retain the local defaults. */
export function renderWorkspaceShell(source, options = {}) {
  plainObject(options, '工作台渲染选项', [
    'assetPrefix', 'extraStyles', 'rootAttributes', 'libraryHidden', 'entry', 'head', 'fallback', 'chrome', 'detailBootstrap',
  ]);
  const { content, attributes, styles } = parseTemplate(source);
  const { assetPrefix, extraStyles, rootAttributes, libraryHidden, entry, head, fallback, chrome, detailBootstrap } = options;
  const originalChrome = { sidebar: content.sidebar.inner, topbar: content.topbar.inner };
  const shellChrome = chrome === undefined ? originalChrome : renderWorkspaceChrome(originalChrome, chrome);
  if (libraryHidden !== undefined && typeof libraryHidden !== 'boolean') {
    throw new TypeError('libraryHidden 必须是布尔值。');
  }
  const entryHtml = entry === undefined ? content.entry.inner
    : entry === null ? ''
    : '<script src="' + escapeHtml(pathUrl(entry, 'entry')) + '" type="module"></script>';
  const data = detailBootstrap === undefined ? '' : '<script id="ilia-detail-data" type="application/json">' +
    JSON.stringify(detailBootstrap).replaceAll('<', '\\u003c') + '</script>';
  return fill(source, [
    { region: attributes.root, value: renderRoot(rootAttributes) },
    { region: attributes.library, value: libraryHidden ? ' hidden' : '' },
    { region: content.head, value: head === undefined ? content.head.inner : renderHead(head) },
    { region: content.theme, value: content.theme.inner },
    { region: content.styles, value: renderStyles(content.styles.inner, styles, assetPrefix, extraStyles) },
    { region: content.sidebar, value: shellChrome.sidebar },
    { region: content.topbar, value: shellChrome.topbar },
    { region: content.fallback, value: fallback === undefined ? content.fallback.inner : renderFallback(fallback) },
    { region: content.entry, value: data + entryHtml },
  ]);
}
