import { icon } from './icons.mjs';

export const PAGE_CATEGORIES = ['浏览全部', '作品集', 'Dashboard', 'SaaS', '电商与品牌', '品牌与机构', '实验与动效', '内容与行业'];
const sourcePriority = ['21st.dev', 'Framer', 'MotionSites'];

const escape = value => String(value ?? '').replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

export const pageCategory = item => item.pageCategory || '内容与行业';
export const pageSource = item => item.sourceShort || item.collectionSource?.name || item.source || '其他来源';
export const pagePromptLabel = item => ({
  original: 'MCP 原始提示词', reference: '设计参考', 'user-edited': '我的提示词', user: '我的提示词',
}[item.promptKind] || '复刻任务');

function sourceOrder(a, b) {
  const ai = sourcePriority.indexOf(a);
  const bi = sourcePriority.indexOf(b);
  return (ai < 0 ? sourcePriority.length : ai) - (bi < 0 ? sourcePriority.length : bi) || a.localeCompare(b, 'en');
}

export function mixPageSources(items) {
  const groups = new Map();
  for (const item of items) {
    const source = pageSource(item);
    if (!groups.has(source)) groups.set(source, []);
    groups.get(source).push(item);
  }
  for (const group of groups.values()) group.sort((a, b) =>
    String(a.originalName || a.name || '').localeCompare(String(b.originalName || b.name || ''), 'en', { numeric: true, sensitivity: 'base' }));
  const sources = [...groups.keys()].sort(sourceOrder);
  const result = [];
  for (let row = 0; result.length < items.length; row++) {
    for (const source of sources) {
      const item = groups.get(source)[row];
      if (item) result.push(item);
    }
  }
  return result;
}

export function filterPageReferences(items, { category = '浏览全部', source = '全部来源', query = '' } = {}) {
  const keyword = query.toLowerCase();
  return mixPageSources(items.filter(item =>
    (category === '浏览全部' || pageCategory(item) === category) &&
    (source === '全部来源' || pageSource(item) === source) &&
    (!keyword || [item.name, item.originalName, item.sourceCategory, item.sourceShort, item.prompt]
      .join(' ').toLowerCase().includes(keyword))));
}

export function renderPageSourcePreview() {
  return '<span class="component-source-preview">在来源页查看预览</span>';
}

export function renderPageReferenceCards(items, { preview, actions = () => '' }) {
  if (!items.length) return '<div class="empty">这个分类还没有页面。</div>';
  return items.map(item => {
    const id = escape(item.id);
    const title = escape(item.name);
    return `<article class="page-reference">
      <div class="favorite-surface"><button type="button" class="page-reference-media" data-open-page="${id}" aria-label="查看 ${title}">${preview(item)}</button>
      ${actions(item)}</div>
      <h3><button type="button" data-open-page="${id}">${title}</button></h3>
      <div class="page-reference-meta"><span>${escape(pageCategory(item))}</span><span>${escape(item.sourceShort || item.source || '手动收藏')}</span><span>${escape(pagePromptLabel(item))}</span></div>
    </article>`;
  }).join('');
}

export function renderPageLibrary(items, { category = '浏览全部', source = '全部来源', query = '', canAdd = false, cards = '' } = {}) {
  const sources = [...new Set(items.map(pageSource))].sort(sourceOrder);
  const counts = new Map();
  for (const item of items) {
    const category = pageCategory(item);
    counts.set(category, (counts.get(category) || 0) + 1);
  }
  const categories = PAGE_CATEGORIES.map(name => `<button type="button" data-page-cat="${name}" class="${category === name ? 'active' : ''}" aria-pressed="${category === name}">${name}<small>${name === '浏览全部' ? items.length : counts.get(name) || 0}</small></button>`).join('');
  const options = sources.map(name => `<option${source === name ? ' selected' : ''}>${escape(name)}</option>`).join('');
  return `<div class="page-heading"><h1>页面库</h1>${canAdd ? '<button type="button" class="primary" id="page-add">' + icon('plus') + '添加页面</button>' : ''}</div>
      <div class="component-layout page-library-layout">
        <nav class="component-categories" aria-label="页面分类">${categories}</nav>
        <section>
          <div class="page-library-search"><input id="page-search" data-command-search aria-label="搜索页面" placeholder="搜索页面、来源或提示词" value="${escape(query)}"><label class="page-source-filter"><span>来源分类</span><select id="page-source" aria-label="按来源筛选页面"><option>全部来源</option>${options}</select></label></div>
          <div class="page-reference-grid">${cards}</div>
        </section>
      </div>`;
}

/** The same 4px tracks and 20px gaps as the source page grid. */
export function sizePageReferences(grid) {
  const ResizeObserver = grid.ownerDocument.defaultView.ResizeObserver;
  if (!ResizeObserver) return;
  const cards = [...grid.querySelectorAll('.page-reference')];
  if (!cards.length) return;
  const track = 4;
  const gap = 20;
  function setSpan(card, height) {
    const span = `span ${Math.ceil((height + gap) / track)}`;
    if (card.style.gridRowEnd !== span) card.style.gridRowEnd = span;
  }
  const heights = cards.map(card => card.getBoundingClientRect().height);
  cards.forEach((card, index) => setSpan(card, heights[index]));
  grid.style.setProperty('--page-grid-track', `${track}px`);
  grid.dataset.masonry = '';
  const observer = new ResizeObserver(entries => {
    for (const entry of entries) {
      setSpan(entry.target, entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height);
    }
  });
  cards.forEach(card => observer.observe(card));
  return observer;
}
