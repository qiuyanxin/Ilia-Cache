import { icon } from './icons.mjs';

export const FONT_GROUPS = ['全部', '中文', '英文', '无衬线', '衬线', '展示', '手写', '等宽', '实验项目'];

const PAGE_SIZE = 72;
const ZH_SAMPLES = ['山川异域 风月同天', '设计让秩序可见', '春水碧于天', '人在画中游', '字里自有山河'];
const EN_SAMPLES = ['Form follows function', 'The quick brown fox', 'Ideas become visible', 'Design is intelligence', 'Type shapes meaning'];
const SAMPLE_SELECTOR = '[data-font-css], [data-font-file]';

const escape = value => String(value ?? '').replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

function cssString(value) {
  return '"' + String(value).replace(/["\\\x00-\x1f\x7f]/g, character =>
    '\\' + character.charCodeAt(0).toString(16) + ' ') + '"';
}

function webUrl(value) {
  try {
    const url = new URL(value);
    if ((url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password) return url.href;
  } catch {}
  return '';
}

function sortFonts(records) {
  return [...records].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'en', {
    numeric: true, sensitivity: 'base',
  }));
}

function matchingFonts(records, group, query) {
  const text = query.toLowerCase();
  return records.filter(record => (
    group === '全部' || (group === '中文' && record.chinese) ||
    (group === '英文' && !record.chinese && record.category !== '实验项目') || record.category === group
  ) && (!text || [record.name, record.source, record.category, record.note].join(' ').toLowerCase().includes(text)));
}

function sampleMarkup(record, detail = false) {
  const hash = [...String(record.id || record.name)].reduce((sum, character) => (sum * 31 + character.charCodeAt(0)) >>> 0, 7);
  const samples = record.chinese ? ZH_SAMPLES : EN_SAMPLES;
  const family = record.localFamily || record.cssFamily || '';
  const familyStyle = family ? 'font-family:' + cssString(family) + ',sans-serif' : '';
  const preview = webUrl(record.previewUrl);
  const file = record.fontUrl || '';
  const tag = detail ? 'div' : 'span';
  const className = detail ? 'font-detail-sample' : 'font-sample';
  return `<${tag} class="${className}" data-font-css="${escape(preview)}" data-font-file="${escape(file)}" data-font-family="${escape(family)}" style="${escape(familyStyle)}"><span>${escape(samples[hash % samples.length])}</span><b>${detail ? 'Aa 0123456789' : 'Aa 0123'}</b></${tag}>`;
}

function fontCards(records, { canDelete, canCollect }) {
  return records.map(record => {
    const { id, name, category, chinese, commercial } = record;
    const deleteButton = canDelete ? `<button type="button" class="font-delete" data-delete-font="${escape(id)}" aria-label="删除字体 ${escape(name)}">${icon('trash')}</button>` : '';
    const collectButton = canCollect ? `<button type="button" class="font-cart-add" data-collect-font="${escape(id)}" aria-label="加入待选 ${escape(name)}">${icon('plus')}</button>` : '';
    return `<article class="font-card" data-font="${escape(id)}">${deleteButton}<button type="button" class="font-card-open" data-open-font="${escape(id)}" aria-label="查看字体 ${escape(name)}">${sampleMarkup(record)}<strong>${escape(name)}</strong><span class="font-meta"><span>${chinese ? '中文' : '英文'}</span><span>${escape(category)}</span><span class="font-license ${String(commercial).includes('免费商用') ? 'is-free' : ''}">${escape(commercial || '版权见来源')}</span></span></button>${collectButton}</article>`;
  }).join('');
}

/** Render the first division of the directory for browsers and server documents. */
export function renderFontLibrary(records, { canAdd = false, canDelete = false, canCollect = false } = {}) {
  const visible = sortFonts(records).slice(0, PAGE_SIZE);
  const addButton = canAdd ? `<button type="button" class="primary" id="font-add">${icon('plus')}添加字体</button>` : '';
  const groups = FONT_GROUPS.map((group, index) => `<button type="button" data-font-group="${group}" class="${index === 0 ? 'active' : ''}" aria-pressed="${index === 0}">${group}</button>`).join('');
  return `<div class="page-heading"><h1>字体库</h1>${addButton}</div>
    <div class="font-toolbar">
      <div role="search" style="flex:1;min-width:min(180px,100%)"><input id="font-search" data-command-search aria-label="搜索字体" placeholder="搜索字体或来源"></div>
      <div class="collection-chips">${groups}</div>
    </div>
    <div class="font-grid">${fontCards(visible, { canDelete, canCollect })}</div>
    <button type="button" class="font-more" id="font-more"${visible.length < records.length ? '' : ' hidden'}>加载更多</button>`;
}

function fontDetail(record) {
  const sourceUrl = webUrl(record.sourceUrl);
  const sourceLink = sourceUrl ? `<a class="primary font-source-link" href="${escape(sourceUrl)}" target="_blank" rel="noopener noreferrer">查看来源 ${icon('arrow-up-right')}</a>` : '';
  return `<div class="font-detail"><div class="dialog-heading"><div><h2 id="font-detail-title">${escape(record.name)}</h2><span>${record.chinese ? '中文' : '英文'} · ${escape(record.category)}</span></div><button type="button" data-close aria-label="关闭">${icon('close')}</button></div>${sampleMarkup(record, true)}<dl><div><dt>许可</dt><dd>${escape(record.commercial || '版权见来源')}</dd></div><div><dt>来源</dt><dd>${escape(record.source || '未填写')}</dd></div></dl>${record.note ? `<p>${escape(record.note)}</p>` : ''}${sourceLink}</div>`;
}

/** Mount onto the native directory and accept write actions from its local host. */
export function mountFontLibrary(page, { getRecords, onAdd, onDelete, onCollect, hydrate = false }) {
  const document = page.ownerDocument;
  const dialog = document.createElement('dialog');
  dialog.id = 'font-dialog';
  document.body.append(dialog);

  const permissions = { canAdd: Boolean(onAdd), canDelete: Boolean(onDelete), canCollect: Boolean(onCollect) };
  const fontResources = new Map();
  let records = sortFonts(getRecords());
  let byId = new Map(records.map(record => [record.id, record]));
  let group = '全部';
  let limit = PAGE_SIZE;

  function loadFont({ dataset: { fontCss, fontFile, fontFamily } }) {
    if (fontCss && !fontResources.has(fontCss)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = fontCss;
      document.head.append(link);
      fontResources.set(fontCss, link);
    }
    if (!fontFile || !fontFamily) return;
    const file = /^\/api\/assets\/[\w.-]+$/.test(fontFile) ? fontFile : webUrl(fontFile);
    const key = `${fontFamily}:${file}`;
    if (!file || fontResources.has(key)) return;
    const style = document.createElement('style');
    style.textContent = `@font-face{font-family:${cssString(fontFamily)};src:url(${cssString(file)});font-display:swap}`;
    document.head.append(style);
    fontResources.set(key, style);
  }

  const observer = new document.defaultView.IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting || !entry.target.isConnected) continue;
      loadFont(entry.target);
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '160px' });
  const observe = root => root.querySelectorAll(SAMPLE_SELECTOR).forEach(sample => observer.observe(sample));
  const unobserve = root => root.querySelectorAll(SAMPLE_SELECTOR).forEach(sample => observer.unobserve(sample));

  if (!hydrate) page.innerHTML = renderFontLibrary(records, permissions);
  const search = page.querySelector('#font-search');
  const grid = page.querySelector('.font-grid');
  const more = page.querySelector('#font-more');

  function renderResults(append = false) {
    const matches = matchingFonts(records, group, search.value);
    if (append) {
      grid.insertAdjacentHTML('beforeend', fontCards(matches.slice(limit - PAGE_SIZE, limit), permissions));
    } else {
      unobserve(grid);
      grid.innerHTML = fontCards(matches.slice(0, limit), permissions);
    }
    more.hidden = limit >= matches.length;
    observe(grid);
  }

  function refresh() {
    records = sortFonts(getRecords());
    byId = new Map(records.map(record => [record.id, record]));
    renderResults();
  }

  function onSearch() {
    limit = PAGE_SIZE;
    renderResults();
  }

  function openDetail(record) {
    dialog.setAttribute('aria-labelledby', 'font-detail-title');
    dialog.innerHTML = fontDetail(record);
    dialog.showModal();
    observe(dialog);
  }

  function onClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    const { fontGroup, openFont, deleteFont, collectFont } = button.dataset;
    if (fontGroup && fontGroup !== group) {
      const previous = page.querySelector('[data-font-group].active');
      previous.classList.remove('active');
      previous.setAttribute('aria-pressed', 'false');
      button.classList.add('active');
      button.setAttribute('aria-pressed', 'true');
      group = fontGroup;
      onSearch();
    } else if (button === more) {
      limit += PAGE_SIZE;
      const firstNewIndex = grid.children.length;
      renderResults(true);
      grid.children[firstNewIndex]?.querySelector('[data-open-font]').focus({ preventScroll: true });
    } else if (button.id === 'font-add') {
      dialog.removeAttribute('aria-labelledby');
      onAdd?.(dialog);
    } else if (openFont && byId.has(openFont)) {
      openDetail(byId.get(openFont));
    } else if (deleteFont && byId.has(deleteFont)) {
      if (onDelete?.(byId.get(deleteFont))) refresh();
    } else if (collectFont && byId.has(collectFont)) {
      onCollect?.(byId.get(collectFont));
    }
  }

  const closeDetail = event => {
    if (event.target.closest('[data-close]')) dialog.close();
  };
  const resetDialog = () => {
    if (dialog.open) return;
    unobserve(dialog);
    dialog.replaceChildren();
  };
  search.addEventListener('input', onSearch);
  page.addEventListener('click', onClick);
  dialog.addEventListener('click', closeDetail);
  dialog.addEventListener('close', resetDialog);
  if (search.value) onSearch();
  else observe(grid);

  function destroy() {
    observer.disconnect();
    search.removeEventListener('input', onSearch);
    page.removeEventListener('click', onClick);
    dialog.remove();
    for (const node of fontResources.values()) node.remove();
  }

  return { refresh, destroy };
}
