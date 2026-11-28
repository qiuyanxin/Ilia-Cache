import { installCardPreviews } from './component-media.mjs';
import { appearsInComponentBrowse, browseComponentRecords, describeComponentBrowse } from './component-browse.mjs';
import { componentBrowseCategory } from './component-categories.mjs';
import { componentWebUrl } from './component-workspace.mjs';
import { renderComponentCard } from './component-card.mjs';
import {
  allComponentCategories as allCategories, allComponentSources as allSources,
  describeComponentDirectoryResults, renderComponentDirectoryStatus, renderComponentFilterChoices, renderGroupedComponentFilters, revealComponentFilterChoice,
} from './component-directory-controls.mjs';
import { COMPONENT_CATEGORIES, componentCategory, hasOriginalMotionBundle, isComponentRecord, sourceName, sourcePage } from './component-taxonomy.mjs';
import { installComponentLaneLayout } from './component-lane-layout.mjs';
import { createComponentSearch } from './component-search.mjs';
import { icon } from './icons.mjs';
import { restoreInputValue } from './input-clear.mjs';

export { splitComponentLanes } from './component-lanes.mjs';

const categories = [allCategories, ...COMPONENT_CATEGORIES];
const indexedPolicies = new Set(['bundled-source', 'official-source-only', 'source-link-only']);

export function selectComponentRecords(records, { category = allCategories, query = '', source = '', readonly = false } = {}) {
  return createDirectorySearch(records.filter(record => isComponentRecord(record)), readonly)({
    category: category === allCategories ? '' : category, query, source,
  });
}

function createDirectorySearch(records, readonly) {
  return createComponentSearch(records, {
    describe: record => ({
      category: componentCategory(record), source: sourceName(record), url: sourcePage(record),
      localMetadata: readonly ? undefined : [record.note, record.url].filter(Boolean).join(' '),
    }),
  });
}

function card(record, { readonly, hasInCart, thumbnail, getCollection, mode }) {
  const accountCollection = getCollection?.(record);
  return renderComponentCard({
    id: record.id, title: record.name,
    description: record.note || (/leibox.*image-compare/.test(record.url) ? '拖动分隔线比较两张图片，松开时边界自然回弹。' : record.description),
    category: mode === 'components' ? componentBrowseCategory(record) : componentCategory(record), source: sourceName(record), sourceHref: sourcePage(record),
    sourceAuthor: record.primarySourceAuthor, indexed: indexedPolicies.has(record.sourcePolicy),
    media: thumbnail(record), interactivePreview: hasOriginalMotionBundle(record),
    previewHref: mode === 'sounds' && (!record.catalogPreview || ['none', 'external'].includes(record.catalogPreview.kind))
      ? componentWebUrl(sourcePage(record)) : undefined,
    collection: accountCollection ?? (readonly ? undefined : { inCart: hasInCart(record.id), usage: record.usage?.length || 0 }),
    workbench: Boolean(accountCollection),
  });
}

export function installComponentDirectory(sheet, options) {
  const { getRecords, readonly, onAdd, onOpen, onRender, onFiltersChanged, playRecipe, toast, mode } = options;
  const soundDirectory = mode === 'sounds';
  const grouped = mode === 'components';
  const entity = soundDirectory ? '音效' : '组件';
  const title = entity + '库';
  const visibleCategories = mode === 'components' ? COMPONENT_CATEGORIES.filter(name => name !== '音效') : COMPONENT_CATEGORIES;
  sheet.innerHTML = `<div class="page-heading"><h1 tabindex="-1">${title}</h1></div>
    <div class="component-layout${soundDirectory ? ' sound-library-layout' : grouped ? ' grouped-component-layout' : ''}">${grouped ? '' :
    `<nav class="component-categories" aria-label="组件分类"${soundDirectory ? ' hidden' : ''}><small>组件</small>
    ${renderComponentFilterChoices('category', visibleCategories)}</nav>`}
    <section><input id="component-search" aria-label="${soundDirectory ? '搜索音效' : '搜索组件'}" placeholder="${soundDirectory ? '搜索音效…' : '搜索组件、效果或提示词…'}">
    ${grouped ? '<div data-grouped-component-filters></div>' : ''}
    <div class="component-source-filters" role="group" aria-label="来源"></div>
    ${renderComponentDirectoryStatus(describeComponentDirectoryResults(0, { entity }))}
    <div class="component-grid"></div></section></div>`;

  const search = sheet.querySelector('#component-search');
  const groupedFilters = sheet.querySelector('[data-grouped-component-filters]');
  const categoryFilters = sheet.querySelector('.component-categories');
  const categoryButtons = [...(categoryFilters?.querySelectorAll('[data-cc]') || [])];
  const sourceFilters = sheet.querySelector('.component-source-filters');
  const status = sheet.querySelector('[data-directory-status]');
  const resultMessage = status.querySelector('[role="status"]');
  const resetFilters = status.querySelector('[data-clear-directory]');
  const grid = sheet.querySelector('.component-grid');
  const layout = installComponentLaneLayout(grid);
  const previews = installCardPreviews(grid, id => options.loadOriginalMotion?.(byId.get(id)));
  const cardTemplate = document.createElement('template');
  let selectRecords = () => [];
  let byId = new Map();
  let visibleCards = new Map();
  let renderedTiles;
  let renderedOriginals;
  let category = grouped ? '' : allCategories;
  let subcategory = '';
  let facets;
  let renderedGroups;
  let source = '';
  let sources = [];

  function renderCards(refreshRecords = false) {
    const filters = getFilters();
    const results = selectRecords(filters);
    const { kind, message, canClear } = describeComponentDirectoryResults(results.length, { ...filters, entity });
    status.dataset.directoryStatus = kind;
    status.classList.toggle('empty', kind === 'empty');
    status.hidden = kind === 'all';
    if (resultMessage.textContent !== message) resultMessage.textContent = message;
    resetFilters.hidden = !canClear;
    grid.hidden = !results.length;
    const entries = results.map(record => {
      const previous = visibleCards.get(record.id);
      if (previous && !refreshRecords) return previous;
      const markup = card(record, options);
      return previous?.markup === markup ? previous : { id: record.id, markup };
    });
    const newCards = entries.filter(entry => !entry.tile);
    if (newCards.length) {
      cardTemplate.innerHTML = newCards.map(entry => entry.markup).join('');
      [...cardTemplate.content.children].forEach((tile, index) => { newCards[index].tile = tile; });
    }
    const tiles = entries.map(({ tile }) => tile);
    const originals = filters.query.trim() ? 0 : results.filter(record => sourceName(record) === '原创').length;
    if (renderedOriginals === originals && renderedTiles && tiles.length === renderedTiles.length &&
        tiles.every((tile, index) => tile === renderedTiles[index])) return;
    renderedTiles = tiles;
    renderedOriginals = originals;
    visibleCards = new Map(entries.map(entry => [entry.id, entry]));
    layout(tiles, originals);
    previews.refresh();
    onRender?.();
  }

  function markCategory(reveal = false) {
    if (grouped) {
      if (!facets) return;
      const markup = renderGroupedComponentFilters(facets, { category, subcategory });
      if (renderedGroups !== markup) {
        groupedFilters.innerHTML = markup;
        renderedGroups = markup;
      }
      if (reveal) for (const group of groupedFilters.children) {
        revealComponentFilterChoice(group, group.querySelector('[aria-pressed="true"]'));
      }
      return;
    }
    for (const button of categoryButtons) {
      const active = category === button.dataset.cc;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    }
    if (reveal) revealComponentFilterChoice(categoryFilters, categoryFilters.querySelector('[aria-pressed="true"]'));
  }

  function markSource(reveal = false) {
    for (const button of sourceFilters.querySelectorAll('[data-source-filter]')) {
      button.setAttribute('aria-pressed', String(button.dataset.sourceFilter === (source || allSources)));
    }
    if (reveal) revealComponentFilterChoice(sourceFilters, sourceFilters.querySelector('[aria-pressed="true"]'));
  }

  function getFilters() {
    return { query: search.value, category: category === allCategories ? '' : category, subcategory, source };
  }

  function applyFilters(filters) {
    if (!filters) return false;
    const nextCategory = grouped ? filters.category || '' : categories.includes(filters.category) ? filters.category : allCategories;
    const nextSubcategory = grouped ? filters.subcategory || '' : '';
    const nextSource = filters.source !== allSources && sources.includes(filters.source) ? filters.source : '';
    const nextValue = filters.query || '';
    if (category === nextCategory && subcategory === nextSubcategory && source === nextSource && search.value === nextValue) return false;
    category = nextCategory;
    subcategory = nextSubcategory;
    source = nextSource;
    restoreInputValue(search, nextValue);
    return true;
  }

  function setFilters(filters, { reveal = false } = {}) {
    const before = { category, source };
    const changed = applyFilters(filters);
    if (!changed && !reveal) return;
    markCategory(reveal || category !== before.category);
    markSource(reveal || source !== before.source);
    if (changed) renderCards();
  }

  function restoreFocus(id, { reveal = false, control = 'preview' } = {}) {
    if (sheet.hidden || (!reveal && sheet.contains(document.activeElement))) return;
    const tile = visibleCards.get(id)?.tile;
    const selector = { preview: 'button.component-thumb', title: '.component-title-control', source: 'a.component-source-name' }[control];
    const target = tile?.querySelector(selector) || tile?.querySelector('.component-title-control') || sheet.querySelector('h1');
    target.focus({ preventScroll: true });
    if (reveal) target.scrollIntoView({ block: 'center', behavior: 'instant' });
  }

  function focusFilter(name, selection) {
    const groupedAttribute = name === 'subcategory' ? 'data-subcategory' : name === 'category' ? 'data-cc' : '';
    const target = grouped && groupedAttribute ? groupedFilters.querySelector(`[${groupedAttribute}][aria-pressed="true"]`) :
      name === 'category' ? categoryButtons.find(button => button.dataset.cc === category) :
      name === 'source' ? sourceFilters.querySelector('[aria-pressed="true"]') :
        name === 'clear' ? (resetFilters.hidden ? sheet.querySelector('h1') : resetFilters) : search;
    target?.focus({ preventScroll: true });
    if (target === search && selection) search.setSelectionRange(...selection);
  }

  function refresh(filters) {
    const records = getRecords().filter(record => isComponentRecord(record) && (!grouped || appearsInComponentBrowse(record)));
    byId = new Map(records.map(record => [record.id, record]));
    facets = grouped ? describeComponentBrowse(records, sourceName) : undefined;
    selectRecords = grouped ? filters => browseComponentRecords(records, filters, { readSource: sourceName, fuzzyFallback: true })
      : createDirectorySearch(records, readonly);
    const counts = new Map([[allCategories, records.length]]);
    for (const record of records) {
      const name = componentCategory(record);
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    for (const button of categoryButtons) button.querySelector('small').textContent = counts.get(button.dataset.cc) || 0;
    const nextSources = [allSources, ...(facets?.sources || new Set(records.map(sourceName)))];
    const sourcesChanged = sources.length !== nextSources.length || nextSources.some((source, index) => source !== sources[index]);
    if (sourcesChanged) {
      sources = nextSources;
      sourceFilters.innerHTML = renderComponentFilterChoices('source', sources.slice(1));
    }
    const before = { category, source };
    applyFilters(filters);
    markCategory(category !== before.category);
    markSource(sourcesChanged || source !== before.source);
    renderCards(true);
  }

  function commitSearch() {
    renderCards();
    onFiltersChanged?.(getFilters());
  }
  search.addEventListener('compositionend', commitSearch);
  search.addEventListener('input', event => {
    if (!event.isComposing) commitSearch();
  });
  resetFilters.addEventListener('click', () => {
    setFilters({}, { reveal: true });
    onFiltersChanged?.(getFilters());
    sheet.querySelector('h1').focus({ preventScroll: true });
  });
  sheet.addEventListener('click', event => {
    const button = event.target.closest('[data-cc],[data-subcategory],[data-source-filter],[data-open-component],#add-component');
    if (!button) return;
    if (button.hasAttribute('data-cc') || button.hasAttribute('data-subcategory')) {
      const primary = button.hasAttribute('data-cc');
      if (primary) category = button.dataset.cc;
      subcategory = primary ? '' : button.dataset.subcategory;
      markCategory(true);
      if (grouped && document.activeElement === document.body) focusFilter(primary ? 'category' : 'subcategory');
      renderCards();
      onFiltersChanged?.(getFilters());
    }
    if (button.dataset.sourceFilter) {
      source = button.dataset.sourceFilter === allSources ? '' : button.dataset.sourceFilter;
      markSource(true);
      renderCards();
      onFiltersChanged?.(getFilters());
    }
    if (button.dataset.openComponent) {
      const record = byId.get(button.dataset.openComponent);
      if (!record) return;
      if (playRecipe && record.soundRecipe && button.classList.contains('component-thumb')) {
        playRecipe(record.soundRecipe).catch(() => toast('音效加载失败'));
      } else {
        onOpen(record.id);
      }
    }
    if (button.id === 'add-component') onAdd?.();
  });
  return { refresh, getCategory: () => category, getFilters, setFilters, restoreFocus, focusFilter, pausePreviews: previews.pause };
}
