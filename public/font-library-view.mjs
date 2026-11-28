import { compareFavoriteNames, favoriteButton } from './favorite-button.mjs';
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

function sortFonts(records, isFavorite) {
  return [...records].sort((a, b) => compareFavoriteNames(a, b, undefined, isFavorite));
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
  const sample = samples[hash % samples.length];
  return `<${tag} class="${className}" data-font-css="${escape(preview)}" data-font-file="${escape(file)}" data-font-family="${escape(family)}" data-default-sample="${escape(sample)}" style="${escape(familyStyle)}"><span>${escape(sample)}</span><b>${detail ? 'Aa 0123456789' : 'Aa 0123'}</b></${tag}>`;
}


function fontCards(records, { canCollect, isFavorite, isCollected }) {
  return records.map(record => {
    const { id, name, category, chinese, commercial } = record;
    const key = escape(id);
    const heart = isFavorite ? favoriteButton('font', record, isFavorite(record)) : '';
    const collected = Boolean(isCollected?.(record));
    const cart = canCollect ? `<button type="button" class="card-action card-action--cart" data-collect-font="${key}" aria-label="${collected ? '已在项目中，继续加入其他项目' : '加入项目'} ${escape(name)}" aria-pressed="${collected}">${icon(collected ? 'check' : 'plus')}</button>` : '';
    return `<article class="font-card" data-font="${key}">
      <div class="favorite-surface">${heart}<button type="button" class="font-card-open" data-open-font="${key}" aria-label="查看字体 ${escape(name)}">${sampleMarkup(record)}</button>${cart}</div>
      <button type="button" class="font-card-caption" data-open-font="${key}"><strong>${escape(name)}</strong><span class="font-meta"><span>${chinese ? '中文' : '英文'}</span><span>${escape(category)}</span><span class="font-license ${String(commercial).includes('免费商用') ? 'is-free' : ''}">${escape(commercial || '版权见来源')}</span></span></button>
    </article>`;
  }).join('');
}

/** Render the first division of the directory for browsers and server documents. */
export function renderFontLibrary(records, { canAdd = false, canDelete = false, canCollect = false, isFavorite } = {}) {
  const visible = sortFonts(records, isFavorite).slice(0, PAGE_SIZE);
  const addButton = canAdd ? `<button type="button" class="primary" id="font-add">${icon('plus')}添加字体</button>` : '';
  const groups = FONT_GROUPS.map((group, index) => `<button type="button" data-font-group="${group}" class="${index === 0 ? 'active' : ''}" aria-pressed="${index === 0}">${group}</button>`).join('');
  return `<div class="page-heading"><h1>字体库</h1>${addButton}</div>
    <div class="font-toolbar">
      <div role="search" style="flex:1;min-width:min(180px,100%)"><input id="font-search" data-command-search aria-label="搜索字体" placeholder="搜索字体或来源"></div>
      <div class="collection-chips">${groups}</div>
    </div>
    <div class="font-preview-controls" aria-label="字体在线预览">
      <label><span>预览文字</span><input id="font-preview-text" maxlength="120" placeholder="输入文字，比较所有字体"></label>
      <label class="font-size-control"><span>字号 <output id="font-preview-size-output">26</output></span><input id="font-preview-size" type="range" min="18" max="54" value="26" aria-label="预览字号"></label>
      <button type="button" class="quiet" id="font-preview-tone" aria-pressed="false">黑底预览</button>
    </div>
    <div class="font-grid">${fontCards(visible, { canDelete, canCollect, isFavorite })}</div>
    <button type="button" class="font-more" id="font-more"${visible.length < records.length ? '' : ' hidden'}>加载更多</button>`;
}

function fontDetail(record, canDelete) {
  const sourceUrl = webUrl(record.sourceUrl);
  const sourceLink = sourceUrl ? `<a class="primary font-source-link" href="${escape(sourceUrl)}" target="_blank" rel="noopener noreferrer">查看来源 ${icon('arrow-up-right')}</a>` : '';
  const deleteButton = canDelete ? `<button class="quiet" type="button" data-delete-font="${escape(record.id)}">删除字体</button>` : '';
  return `<div class="font-detail"><div class="dialog-heading"><div><h2 id="font-detail-title">${escape(record.name)}</h2><span>${record.chinese ? '中文' : '英文'} · ${escape(record.category)}</span></div><button type="button" data-close aria-label="关闭">${icon('close')}</button></div>${sampleMarkup(record, true)}<div class="font-detail-controls"><label><span>预览文字</span><input data-detail-preview maxlength="120" placeholder="输入文字预览"></label><label class="font-size-control"><span>字号 <output data-detail-size-output>54</output></span><input data-detail-size type="range" min="24" max="96" value="54" aria-label="详情预览字号"></label><button type="button" class="quiet" data-detail-tone aria-pressed="false">黑底预览</button></div><dl><div><dt>许可</dt><dd>${escape(record.commercial || '版权见来源')}</dd></div><div><dt>来源</dt><dd>${escape(record.source || '未填写')}</dd></div></dl>${record.note ? `<p>${escape(record.note)}</p>` : ''}<div class="dialog-actions">${deleteButton}${sourceLink}</div></div>`;
}

/** Mount onto the native directory and accept write actions from its local host. */
export function mountFontLibrary(page, { getRecords, onAdd, onDelete, onCollect, canCollect = Boolean(onCollect), showAdd = Boolean(onAdd), isFavorite, isCollected, hydrate = false }) {
  const document = page.ownerDocument;
  const dialog = document.createElement('dialog');
  dialog.id = 'font-dialog';
  document.body.append(dialog);

  const permissions = { canAdd: showAdd, canDelete: Boolean(onDelete), canCollect, isFavorite, isCollected };
  const fontResources = new Map();
  let records = sortFonts(getRecords(), isFavorite);
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
    const file = /^\/(?:api\/assets|fonts)\/[\w.-]+$/.test(fontFile) ? fontFile : webUrl(fontFile);
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
  const previewText = page.querySelector('#font-preview-text');
  const previewSize = page.querySelector('#font-preview-size');
  const previewSizeOutput = page.querySelector('#font-preview-size-output');
  const previewTone = page.querySelector('#font-preview-tone');
  const grid = page.querySelector('.font-grid');
  const more = page.querySelector('#font-more');

  function applyListPreview() {
    const text = previewText.value.trim();
    grid.querySelectorAll('.font-sample>span').forEach((sample, index) => {
      if (text) sample.textContent = text;
      else {
        const record = byId.get(grid.children[index]?.dataset.font);
        const hash = [...String(record?.id || record?.name || '')].reduce((sum, character) => (sum * 31 + character.charCodeAt(0)) >>> 0, 7);
        const samples = record?.chinese ? ZH_SAMPLES : EN_SAMPLES;
        sample.textContent = samples[hash % samples.length];
      }
    });
    page.style.setProperty('--font-preview-size', previewSize.value + 'px');
    previewSizeOutput.value = previewSize.value;
  }

  function renderResults(append = false) {
    const matches = matchingFonts(records, group, search.value);
    if (append) {
      grid.insertAdjacentHTML('beforeend', fontCards(matches.slice(limit - PAGE_SIZE, limit), permissions));
    } else {
      unobserve(grid);
      grid.innerHTML = fontCards(matches.slice(0, limit), permissions);
    }
    more.hidden = limit >= matches.length;
    applyListPreview();
    observe(grid);
  }

  function refresh() {
    records = sortFonts(getRecords(), isFavorite);
    byId = new Map(records.map(record => [record.id, record]));
    renderResults();
  }

  function onSearch() {
    limit = PAGE_SIZE;
    renderResults();
  }

  function openDetail(record) {
    if (!record) return;
    dialog.setAttribute('aria-labelledby', 'font-detail-title');
    dialog.innerHTML = fontDetail(record, permissions.canDelete);
    dialog.showModal();
    observe(dialog);
  }

  function onClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    const { fontGroup, openFont, collectFont } = button.dataset;
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
    } else if (button === previewTone) {
      const inverted = !page.classList.contains('font-preview-invert');
      page.classList.toggle('font-preview-invert', inverted);
      previewTone.setAttribute('aria-pressed', String(inverted));
      previewTone.textContent = inverted ? '白底预览' : '黑底预览';
    } else if (openFont && byId.has(openFont)) {
      openDetail(byId.get(openFont));

    } else if (collectFont && byId.has(collectFont)) {
      const record = byId.get(collectFont);
      onCollect?.(record);
      const collected = Boolean(isCollected?.(record));
      button.innerHTML = icon(collected ? 'check' : 'plus');
      button.setAttribute('aria-pressed', String(collected));
      button.setAttribute('aria-label', (collected ? '已在项目中，继续加入其他项目 ' : '加入项目 ') + record.name);
    }
  }

  const closeDetail = event => {
    if (event.target.closest('[data-close]')) dialog.close();
    const tone = event.target.closest('[data-detail-tone]');
    if (tone) {
      const sample = dialog.querySelector('.font-detail-sample');
      const inverted = !sample.classList.contains('is-inverted');
      sample.classList.toggle('is-inverted', inverted);
      tone.setAttribute('aria-pressed', String(inverted));
      tone.textContent = inverted ? '白底预览' : '黑底预览';
    }
    const removed = event.target.closest('[data-delete-font]')?.dataset.deleteFont;
    if (removed && byId.has(removed) && onDelete?.(byId.get(removed))) {
      dialog.close();
      refresh();
    }
  };
  const updateDetailPreview = event => {
    const sample = dialog.querySelector('.font-detail-sample');
    if (!sample) return;
    if (event.target.matches('[data-detail-preview]')) {
      const value = event.target.value.trim();
      sample.querySelector('span').textContent = value || sample.dataset.defaultSample;
    } else if (event.target.matches('[data-detail-size]')) {
      sample.style.setProperty('--font-detail-size', event.target.value + 'px');
      dialog.querySelector('[data-detail-size-output]').value = event.target.value;
    }
  };
  const resetDialog = () => {
    if (dialog.open) return;
    unobserve(dialog);
    dialog.replaceChildren();
  };
  search.addEventListener('input', onSearch);
  previewText.addEventListener('input', applyListPreview);
  previewSize.addEventListener('input', applyListPreview);
  page.addEventListener('click', onClick);
  dialog.addEventListener('click', closeDetail);
  dialog.addEventListener('input', updateDetailPreview);
  dialog.addEventListener('close', resetDialog);
  if (search.value) onSearch();
  else observe(grid);

  function destroy() {
    observer.disconnect();
    search.removeEventListener('input', onSearch);
    previewText.removeEventListener('input', applyListPreview);
    previewSize.removeEventListener('input', applyListPreview);
    page.removeEventListener('click', onClick);
    dialog.removeEventListener('input', updateDetailPreview);
    dialog.remove();
    for (const node of fontResources.values()) node.remove();
  }

  return {
    refresh, destroy, open: id => openDetail(byId.get(id)),
    add(){ dialog.removeAttribute('aria-labelledby');onAdd?.(dialog); },
  };
}
