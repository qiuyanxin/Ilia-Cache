import { styleReferenceGroup } from './component-categories.mjs';
import { favoriteButton, esc } from './favorite-button.mjs';
import { validPublicWebUrl } from './catalog.mjs';
import { isComponent, isSoundEffect, sourceName, componentCategory } from './extensions.js';
import { connectCollectionPreviews } from './component-media.mjs';

const TYPES = {
  component: '组件',
  style: '风格参考',
  sound: '音效',
  font: '字体',
  website: '网站',
  page: '页面',
};
export function installFavorites(h, fontLibrary, pageLibrary) {
  const page = document.createElement('main');
  page.id = 'my-favorites';
  page.hidden = true;
  document.querySelector('.workspace').append(page);
  let filter = 'all';

  function card(item, type) {
    const open = `data-favorite-open="${type}" data-favorite-id="${esc(item.id)}"`;
    const url = validPublicWebUrl(item.url);
    const domain = url ? new URL(url).hostname.replace(/^www\./, '') : '';
    const media = type === 'component' || type === 'style' || type === 'sound'
      ? h.componentMedia(item)
      : type === 'page'
        ? h.cardMedia(item)
        : '';
    const localCover = type === 'website' ? h.screenshot(item) : '';
    const cover = media.replace(/<\/?a\b[^>]*>/g, '') ||
      (localCover.startsWith('/previews/')
        ? `<img src="${esc(localCover)}" alt="" loading="lazy">`
        : `<span class="favorite-card-monogram">${esc(type === 'font' ? 'Aa' : item.name.slice(0, 1))}</span>`);
    const source = type === 'website' ? domain : type === 'font' ? item.source : sourceName(item);
    const tag = type === 'component' || type === 'style' ? componentCategory(item) : type === 'page' ? item.pageCategory : item.category;
    // Uses the Swipe Deck card's preview, title, metadata and tag hierarchy.
    return `<article class="favorite-card">
      <div class="favorite-surface">
        <div class="favorite-card-preview component-thumb">${cover}</div>
        ${favoriteButton(type, item, true)}
      </div>
      <div class="favorite-card-body">
        <div class="favorite-card-title">${type === 'website'
          ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(item.name)}</a>`
          : `<button type="button" ${open}>${esc(item.name)}</button>`}<span>${TYPES[type]}</span></div>
        ${source ? `<p>${esc(source)}</p>` : ''}
        ${tag && tag !== TYPES[type] ? `<span class="favorite-card-tag">${esc(tag)}</span>` : ''}
      </div>
    </article>`;
  }

  function render() {
    const state = h.getState();
    const items = [
      ...state.resources.filter(item => !item.archived && item.favorite).flatMap(item => {
        if (isComponent(item)) return [{ item, type: isSoundEffect(item) ? 'sound' : styleReferenceGroup(item) ? 'style' : 'component' }];
        if (item.caseType === '网页参考' || item.pageCategory) return [{ item, type: 'page' }];
        return [];
      }),
      ...fontLibrary.favoriteRows().map(item => ({ item, type: 'font' })),
      ...h.sites().filter(item => item.favorite).map(item => ({ item, type: 'website' })),
    ];
    const visible = items.filter(({ type }) => filter === 'all' || filter === type);
    page.innerHTML = `<div class="page-heading"><h1>工作台</h1></div>
      <nav class="collection-chips accumulation-tabs" aria-label="工作台分类"><button data-accumulation-view="inbox">收件箱</button><button data-accumulation-view="projects">项目</button><button data-accumulation-view="aesthetic">审美采集</button><button data-accumulation-view="accumulation">灵感库</button><button data-accumulation-view="favorites" class="active">收藏</button></nav>
      <div class="collection-chips" role="group" aria-label="收藏类型">${Object.entries({ all: '全部', ...TYPES }).map(([key, label]) => {
        const count = key === 'all' ? items.length : items.filter(({ type }) => type === key).length;
        return `<button type="button" data-favorite-filter="${key}" class="${filter === key ? 'active' : ''}" aria-pressed="${filter === key}">${label} <small>${count}</small></button>`;
      }).join('')}</div>
      ${visible.length ? `<div class="favorites-grid">${visible.map(({ item, type }) => card(item, type)).join('')}</div>` : '<p class="empty">还没有收藏。点卡片上的爱心，就能在这里找到。</p>'}`;
    connectCollectionPreviews(page);
  }

  page.onclick = event => {
    const workbenchButton = event.target.closest('[data-accumulation-view]');
    if (workbenchButton) {
      h.switchView(workbenchButton.dataset.accumulationView);
      return;
    }
    const filterButton = event.target.closest('[data-favorite-filter]');
    if (filterButton) {
      filter = filterButton.dataset.favoriteFilter;
      render();
      page.querySelector('[aria-pressed="true"][data-favorite-filter]')?.focus();
      return;
    }
    const button = event.target.closest('[data-favorite-open]');
    if (!button) return;
    const { favoriteOpen: type, favoriteId: id } = button.dataset;
    if (type === 'font') fontLibrary.open(id);
    else if (type === 'page') pageLibrary.openPage(id);
    else h.openComponent(id);
  };

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-heart-type]');
    if (!button) return;
    const { heartType: type, heartId: id, heartName: name } = button.dataset;
    let selected;
    if (type === 'font') {
      selected = fontLibrary.toggleFavorite(id);
    } else if (type === 'website') {
      selected = h.toggleWebsiteFavorite(id);
    } else {
      const item = h.getState().resources.find(resource => resource.id === id && !resource.archived);
      if (!item) return;
      selected = item.favorite = !item.favorite;
      h.save();
    }
    if (typeof selected !== 'boolean') return;
    const label = `${selected ? '取消收藏' : '收藏'} ${name}`;
    for (const heart of document.querySelectorAll('[data-heart-type][data-heart-id]')) {
      if (heart.dataset.heartType !== type || heart.dataset.heartId !== id) continue;
      heart.setAttribute('aria-pressed', String(selected));
      heart.setAttribute('aria-label', label);
      heart.title = label;
    }
    h.toast(selected ? '已收藏' : '已取消收藏');
    if (!page.hidden) {
      render();
      page.querySelector('[aria-pressed="true"][data-favorite-filter]')?.focus();
    }
  });

  h.refreshFavorites = () => { if (!page.hidden) render(); };

  return {
    show() {
      document.querySelector('#library').hidden = true;
      document.querySelector('#learning').hidden = true;
      document.querySelector('#breadcrumb').textContent = '工作台';
      page.hidden = false;
      render();
      fontLibrary.ready.then(() => { if (!page.hidden) render(); });
    },
    leave() { page.hidden = true; },
  };
}
