import { COMPONENT_BROWSE_GROUPS, componentBrowseCategory, styleReferenceGroup } from './component-categories.mjs';
import { isLibraryComponent, isSoundEffect, sourceName, sourcePage } from './component-taxonomy.mjs';
import { componentLoadRank, connectCollectionPreviews, pauseCollectionPreviews } from './component-media.mjs';
import { compareComponentTitles } from './component-search.mjs';
import { renderComponentCard } from './component-card.mjs';
import { esc } from './favorite-button.mjs';
import { icon } from './icons.mjs';

const ALL_SOURCES = '全部来源';
const BATCH_SIZE = 36;

function browseRecords(records, { query, category, subcategory, source }) {
  const accepted = subcategory ? [subcategory] : COMPONENT_BROWSE_GROUPS[category];
  const keyword = query.toLowerCase();
  return records.filter(record => {
    const facet = componentBrowseCategory(record);
    const origin = sourceName(record);
    return (!accepted || accepted.includes(facet)) && (!source || source === origin) &&
      (!keyword || [
        record.name, record.originalName, record.note, record.prompt, record.url,
        record.primarySourceAuthor, origin, facet, category, ...(record.tags || []),
      ].join(' ').toLowerCase().includes(keyword));
  }).sort((a, b) => Number(sourceName(a) === 'Motion Prompt') - Number(sourceName(b) === 'Motion Prompt') ||
    (!category ? (b.usage?.length || 0) - (a.usage?.length || 0) : 0) ||
    componentLoadRank(a) - componentLoadRank(b) || compareComponentTitles(a, b));
}

function directoryCard(record, { hasInCart, thumbnail }) {
  return renderComponentCard({
    id: record.id, title: record.name, description: record.note ||
      (/leibox.*image-compare/.test(record.url) ? '拖动分隔线比较两张图片，松开时边界自然回弹。' : record.description),
    category: componentBrowseCategory(record), source: sourceName(record), sourceHref: sourcePage(record),
    sourceAuthor: record.primarySourceAuthor, media: thumbnail(record), workbench: true,
    collection: {
      inCart: hasInCart(record.id), usage: record.usage?.length || 0, favorite: record.favorite,
      favoriteType: isSoundEffect(record) ? 'sound' : styleReferenceGroup(record) ? 'style' : 'component',
    },
  });
}

/** Mount the workbench gallery filters and source groups over shared card and detail controls. */
export function installWorkbenchDirectory(sheet, options) {
  const { getRecords, onAdd, onOpen, onRender, onFiltersChanged, playRecipe, toast } = options;
  let soundMode = false;
  let category = '', subcategory = '', query = '', source = '';
  let browseObserver, collectionObserver;
  const collectionGrids = new WeakSet();

  function activate(event) {
    const button = event.target.closest('[data-open-component]');
    if (!button) return;
    const record = getRecords().find(entry => entry.id === button.dataset.openComponent);
    if (!record) return;
    if (record.soundRecipe && button.classList.contains('component-thumb')) {
      playRecipe(record.soundRecipe).catch(() => toast('音效加载失败'));
    } else onOpen(record.id);
  }

  function fill(grid, records) {
    grid.replaceChildren();
    if (!records.length) {
      grid.innerHTML = '<div class="empty">这里还没有组件。</div>';
      return;
    }
    let shown = 0;
    const motionStart = records.findIndex(record => sourceName(record) === 'Motion Prompt');
    const sentinel = document.createElement('div');
    sentinel.className = 'component-load-sentinel';
    grid.append(sentinel);
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) append();
    }, { rootMargin: '1000px 0px' });
    function append() {
      const batch = records.slice(shown, shown + BATCH_SIZE);
      sentinel.insertAdjacentHTML('beforebegin', batch.map((record, index) =>
        (motionStart > 0 && shown + index === motionStart ? '<div class="component-source-break" aria-hidden="true"></div>' : '') +
        directoryCard(record, options),
      ).join(''));
      shown += batch.length;
      connectCollectionPreviews(grid);
      onRender?.();
      if (shown >= records.length) {
        sentinel.remove();
        observer.disconnect();
      } else sentinel.textContent = `已显示 ${shown} / ${records.length}`;
    }
    append();
    if (sentinel.isConnected) observer.observe(sentinel);
    return observer;
  }

  const getFilters = () => ({ query, category, subcategory, source });
  function restore(filters) {
    ({ query = '', category = '', subcategory = '', source = '' } = filters || {});
  }
  const libraryItems = () => getRecords().filter(soundMode ? isSoundEffect : isLibraryComponent);

  function renderResults() {
    browseObserver?.disconnect();
    browseObserver = fill(sheet.querySelector('.component-grid'), browseRecords(libraryItems(), getFilters()));
  }

  function render() {
    const all = libraryItems();
    const sourceCounts = new Map();
    const categoryCounts = new Map();
    for (const record of all) {
      const facet = componentBrowseCategory(record);
      const origin = sourceName(record);
      sourceCounts.set(origin, (sourceCounts.get(origin) || 0) + 1);
      categoryCounts.set(facet, (categoryCounts.get(facet) || 0) + 1);
    }
    const sources = [ALL_SOURCES, ...[...sourceCounts.keys()].sort((a, b) => sourceCounts.get(b) - sourceCounts.get(a))];
    const countGroup = keys => keys.reduce((total, key) => total + (categoryCounts.get(key) || 0), 0);
    const choice = (label, value, count, active, attribute) =>
      `<button type="button" ${attribute}="${esc(value)}" class="${active ? 'active' : ''}" aria-pressed="${active}">${esc(label)}<small>${count}</small></button>`;
    const choices = choice('全部', '', all.length, !category, 'data-cc') + Object.entries(COMPONENT_BROWSE_GROUPS).map(([name, keys]) =>
      choice(name, name, countGroup(keys), category === name, 'data-cc')).join('');
    const group = COMPONENT_BROWSE_GROUPS[category] || [];
    const available = group.filter(key => categoryCounts.has(key));
    const subchoices = group.length > 1 && available.length
      ? `<nav class="component-categories component-subcategories" aria-label="${esc(category)}细分">${choice('全部' + category, '', countGroup(available), !subcategory, 'data-subcategory')}${available.map(key => choice(key, key, categoryCounts.get(key), subcategory === key, 'data-subcategory')).join('')}</nav>` : '';
    const previousGrid = sheet.querySelector('.component-grid');
    sheet.innerHTML = `<div class="page-heading"><h1 tabindex="-1">${soundMode ? '音效库' : '组件库'}</h1>${soundMode ? '' : `<button class="primary" id="add-component">${icon('plus')}添加组件</button>`}</div>
      <div class="component-layout${soundMode ? ' sound-library-layout' : ''}"><section>
      <input id="component-search" aria-label="${soundMode ? '搜索音效' : '搜索组件'}" placeholder="${soundMode ? '搜索音效…' : '搜索组件、效果或提示词…'}" value="${esc(query)}">
      ${soundMode ? '' : `<nav class="component-categories" aria-label="组件分类">${choices}</nav>${subchoices}`}
      <div class="component-source-filters">${sources.map(name => `<button type="button" data-source-filter="${esc(name)}" aria-pressed="${(source || ALL_SOURCES) === name}">${esc(name)}</button>`).join('')}</div>
      <div class="component-grid"></div></section></div>`;
    if (previousGrid) sheet.querySelector('.component-grid').replaceWith(previousGrid);
    renderResults();
  }

  function commitSearch(event) {
    if (!event.target.matches('#component-search') || event.isComposing) return;
    query = event.target.value;
    renderResults();
    onFiltersChanged?.(getFilters());
  }
  sheet.addEventListener('input', commitSearch);
  sheet.addEventListener('compositionend', commitSearch);
  sheet.addEventListener('click', event => {
    const group = event.target.closest('[data-cc],[data-subcategory]');
    if (group) {
      const byGroup = group.hasAttribute('data-cc');
      if (byGroup) category = group.dataset.cc;
      subcategory = byGroup ? '' : group.dataset.subcategory;
      render();
      if (event.detail === 0) sheet.querySelector(`${byGroup ? '[data-cc]' : '[data-subcategory]'}[aria-pressed=true]`)?.focus();
      onFiltersChanged?.(getFilters());
      return;
    }
    const selected = event.target.closest('[data-source-filter]');
    if (selected) {
      source = selected.dataset.sourceFilter === ALL_SOURCES ? '' : selected.dataset.sourceFilter;
      for (const button of sheet.querySelectorAll('[data-source-filter]')) button.setAttribute('aria-pressed', String(button === selected));
      renderResults();
      onFiltersChanged?.(getFilters());
      return;
    }
    if (event.target.closest('#add-component')) onAdd?.();
    else activate(event);
  });

  return {
    refresh(filters) { if (filters) restore(filters); render(); },
    getCategory: () => subcategory || COMPONENT_BROWSE_GROUPS[category]?.[0] || '',
    getFilters,
    setFilters(filters) {
      if (JSON.stringify(getFilters()) === JSON.stringify(filters)) return;
      restore(filters);
      render();
    },
    focusFilter(name) {
      sheet.querySelector(name === 'category' ? '[data-cc][aria-pressed=true]' : name === 'source' ?
        '[data-source-filter][aria-pressed=true]' : '#component-search')?.focus();
    },
    restoreFocus(id) {
      if (sheet.hidden) return;
      const button = [...sheet.querySelectorAll('.component-thumb[data-open-component]')]
        .find(entry => entry.dataset.openComponent === id);
      (button || sheet.querySelector('h1'))?.focus({ preventScroll: true });
    },
    setSoundMode(value) { if (value !== soundMode) { soundMode = value; restore(); } },
    pausePreviews() {
      browseObserver?.disconnect();
      const grid = sheet.querySelector('.component-grid');
      if (grid) pauseCollectionPreviews(grid);
    },
    renderCollection(grid, records) {
      collectionObserver?.disconnect();
      if (!collectionGrids.has(grid)) {
        grid.addEventListener('click', activate);
        collectionGrids.add(grid);
      }
      collectionObserver = fill(grid, records);
    },
    stopCollection() { collectionObserver?.disconnect(); },
  };
}
