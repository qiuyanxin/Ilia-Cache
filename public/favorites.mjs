import { styleReferenceGroup } from './component-categories.mjs';
import { favoriteButton, esc } from './favorite-button.mjs';
import { validPublicWebUrl } from './catalog.mjs';
import { isComponent, isSoundEffect, sourceName, componentCategory } from './extensions.js';
import { connectCollectionPreviews } from './component-media.mjs';
import { icon } from './icons.mjs';
import { WORKBENCH_TYPES, filterByWorkbenchType, workbenchTabs, workbenchTypeTabs } from './workbench-taxonomy.mjs';

const favoriteType = ({ type }) => type === 'style' ? 'visual' : type;
export function installFavorites(h, fontLibrary, pageLibrary) {
  const page = document.createElement('main');
  page.id = 'my-favorites';
  page.hidden = true;
  document.querySelector('.workspace').append(page);
  let filter = 'all';

  function projectButton(item, type) {
    const resource = ['component', 'style', 'sound'].includes(type);
    const added = resource && h.projects?.has(item.id);
    const attribute = resource
      ? `data-project-add="${esc(item.id)}" data-favorite-project-resource`
      : `data-favorite-project="${esc(item.id)}" data-favorite-project-type="${type}"`;
    const label = added ? '已在项目中，继续加入其他项目' : '加入项目';
    return `<button type="button" class="card-action card-action--cart" ${attribute} aria-label="${label} ${esc(item.name)}" aria-pressed="${Boolean(added)}" title="${label}">${icon(added ? 'check' : 'folder')}</button>`;
  }

  function projectReference(item, type) {
    if (type === 'website') return { id: `site:${item.id}`, type, name: item.name, image: h.screenshot(item), url: item.url };
    if (type === 'font') return { id: `font:${item.id}`, type, name: item.name, image: '', url: item.sourceUrl || '' };
    const image = item.media?.find(entry => entry.type === 'image')?.url || item.preview || '';
    return { id: `page:${item.id}`, type: 'page', resourceId: item.id, name: item.name, image, url: item.url };
  }

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
        ${projectButton(item, type)}
        ${favoriteButton(type, item, true)}
      </div>
      <div class="favorite-card-body">
        <div class="favorite-card-title">${type === 'website'
          ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(item.name)}</a>`
          : `<button type="button" ${open}>${esc(item.name)}</button>`}<span>${WORKBENCH_TYPES[favoriteType({ type })]}</span></div>
        ${source ? `<p>${esc(source)}</p>` : ''}
        ${tag && tag !== WORKBENCH_TYPES[favoriteType({ type })] ? `<span class="favorite-card-tag">${esc(tag)}</span>` : ''}
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
    const visible = filterByWorkbenchType(items, filter, favoriteType);
    page.innerHTML = `<div class="page-heading"><h1>工作台</h1></div>
      ${workbenchTabs('favorites')}
      ${workbenchTypeTabs(filter, items, favoriteType, 'data-favorite-filter')}
      ${visible.length ? `<div class="favorites-grid">${visible.map(({ item, type }) => card(item, type)).join('')}</div>` : '<p class="empty">还没有收藏。点卡片上的爱心，就能在这里找到。</p>'}`;
    connectCollectionPreviews(page);
    page.querySelectorAll('[data-favorite-project]').forEach(button => {
      const type = button.dataset.favoriteProjectType;
      const item = items.find(row => row.type === type && row.item.id === button.dataset.favoriteProject)?.item;
      if (item) h.projects?.bindReferenceButton(button, projectReference(item, type));
    });
  }

  page.onclick = event => {
    const workbenchButton = event.target.closest('[data-workbench-view]');
    if (workbenchButton) {
      h.switchView(workbenchButton.dataset.workbenchView);
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
    const focused = document.activeElement === button;
    if (type === 'page') pageLibrary.refreshOrder();
    else if (type === 'component' || type === 'sound') h.refreshComponents?.();
    else if (type === 'style') h.collections?.render();
    else if (type === 'website' && document.querySelector('#library:not([hidden])')) h.render();
    const hearts = [...document.querySelectorAll('[data-heart-type][data-heart-id]')]
      .filter(heart => heart.dataset.heartType === type && heart.dataset.heartId === id);
    for (const heart of hearts) {
      heart.setAttribute('aria-pressed', String(selected));
      heart.setAttribute('aria-label', label);
      heart.title = label;
    }
    h.toast(selected ? '已收藏' : '已取消收藏');
    if (!page.hidden) {
      render();
      page.querySelector('[aria-pressed="true"][data-favorite-filter]')?.focus();
    } else if (focused && !button.isConnected) hearts.find(heart => !heart.closest('[hidden]'))?.focus({ preventScroll: true });
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
