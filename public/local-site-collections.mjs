import { favoriteButton } from './favorite-button.mjs';
import { icon } from './icons.mjs';
import { bindButtonPress } from './springs.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

function siteCard(site, screenshot) {
  const { id, name, url } = site;
  return `<article class="website-card">
    <div class="favorite-surface"><a href="${escape(url)}" target="_blank" rel="noopener noreferrer"><img loading="lazy" src="${escape(screenshot(site))}" alt="${escape(name)} 首页"></a>
      ${favoriteButton('website', site, site.favorite)}<button type="button" class="card-action card-action--cart" data-website-card-cart="${escape(id)}">${icon('plus')}</button></div>
    <div><h3><a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(name)}</a></h3>
    <p>${escape(site.finds || site.description)}</p><span>${escape(site.category)}</span>
<button data-web-preview="${escape(id)}">预览网站 ↗</button></div>
  </article>`;
}

export function installLocalSiteCollections(h) {
  const { getState, save, toast, sites, choose, render, nav, screenshot } = h;
  const list = document.querySelector('#resource-list');
  const layout = document.querySelector('.library-layout');
  const inspector = document.querySelector('#inspector');
  const viewSwitch = document.createElement('div');
  viewSwitch.className = 'view-switch';
  viewSwitch.innerHTML = '<button data-layout="list" aria-pressed="true">☷ 列表</button><button data-layout="deck" aria-pressed="false">▱ 卡片</button>';
  document.querySelector('.list-head').after(viewSwitch);

  const deck = document.createElement('div');
  deck.id = 'website-deck';
  deck.hidden = true;
  viewSwitch.after(deck);

  const dialog = document.createElement('dialog');
  dialog.id = 'site-editor';
  document.body.append(dialog);

  const iconLookups = new Set();
  let deckMode = false;

  function findSite(id) {
    return sites().find(site => site.id === id);
  }

  h.bindWebsiteCart = (button, site) => h.projects?.bindReferenceButton(button, {
    id: 'site:' + site.id, type: 'website', name: site.name, image: screenshot(site), url: site.url,
  });

  function addToCart(site) {
    h.projects?.addReferenceToCart({
      id: 'site:' + site.id, type: 'website', name: site.name,
      image: screenshot(site), url: site.url,
    });
  }

  function updateDeck() {
    list.hidden = deckMode;
    deck.hidden = !deckMode;
    layout.classList.toggle('website-grid-mode', deckMode);
    viewSwitch.querySelectorAll('button').forEach(button => {
      button.setAttribute('aria-pressed', String((button.dataset.layout === 'deck') === deckMode));
    });
    if (!deckMode) {
      const selected = list.querySelector('.resource-row.selected')?.dataset.site;
      if (selected) choose(selected);
      return;
    }
    inspector.replaceChildren();
    const rows = h.filtered();
    deck.innerHTML = `<div class="website-card-grid">${rows.map(site => siteCard(site, screenshot)).join('')}</div>`;
    for (const button of deck.querySelectorAll('[data-website-card-cart]')) {
      const site = findSite(button.dataset.websiteCardCart);
      if (site) h.bindWebsiteCart(button, site);
    }
  }

  viewSwitch.addEventListener('click', event => {
    const button = event.target.closest('[data-layout]');
    if (!button) return;
    deckMode = button.dataset.layout === 'deck';
    updateDeck();
  });
  deck.addEventListener('click', event => {
    const button = event.target.closest('[data-site-cart], [data-web-preview]');
    if (!button) return;
    if (button.hasAttribute('data-site-cart')) {
      const site = findSite(button.dataset.siteCart);
      if (site) addToCart(site);
      return;
    }
    deckMode = false;
    updateDeck();
    choose(button.dataset.webPreview);
  });
  new MutationObserver(() => {
    if (deckMode) updateDeck();
  }).observe(list, { childList: true });

  new MutationObserver(() => {
    const theme = document.documentElement.dataset.theme;
    deck.querySelectorAll('iframe').forEach(frame => {
      frame.contentWindow.postMessage({ type: 'motion:theme', theme }, '*');
    });
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.addEventListener('message', event => {
    const frame = deck.querySelector('iframe');
    if (!frame || event.source !== frame.contentWindow || event.data?.type !== 'ilia:swipe') return;
    choose(event.data.nextId || event.data.id);
    if (event.data.dir !== 1) return;
    const site = findSite(event.data.id);
    if (!site || site.favorite) return;
    site.members.forEach(record => { record.favorite = true; });
    save();
    nav();
    toast(`${site.name} 已加入精选`);
  });

  function editSite(site) {
    dialog.innerHTML = `<form>
      <div class="dialog-heading"><h2>修改网站</h2><button type="button" data-close>×</button></div>
      <label>网站名称<input name="name" required value="${escape(site.name)}"></label>
      <label>网站域名 / 首页<input name="url" type="url" required value="${escape(site.url)}"></label>
      <label>能找到什么<textarea name="finds">${escape(site.finds || site.description)}</textarea></label>
      <label>有什么用<textarea name="use">${escape(site.use || '')}</textarea></label>
      <div class="dialog-actions"><button type="button" data-site-delete>${icon('trash')}移除网站</button><button class="primary">保存修改</button></div>
    </form>`;
    dialog.querySelector('[data-close]').onclick = () => dialog.close();
    bindButtonPress(dialog.querySelector('button.primary'));
    dialog.querySelector('[data-site-delete]').onclick = () => {
      dialog.close();
      archiveSite(site);
    };
    dialog.querySelector('form').onsubmit = event => {
      event.preventDefault();
      const fields = new FormData(event.currentTarget);
      const home = new URL(fields.get('url'));
      if (!['https:', 'http:'].includes(home.protocol)) return;
      const domain = home.hostname.replace(/^www\./, '');
      const state = getState();
      state.siteOverrides ||= {};
      state.siteOverrides[domain] = {
        ...state.siteOverrides[site.domain],
        name: fields.get('name'), homeUrl: home.href, finds: fields.get('finds'), use: fields.get('use'),
      };
      if (domain !== site.domain) {
        site.members.forEach(record => {
          const old = new URL(record.url);
          record.originalUrl ||= record.url;
          record.url = home.origin + old.pathname + old.search + old.hash;
        });
      }
      save();
      nav();
      render();
      dialog.close();
      toast('网站信息已更新');
    };
    dialog.showModal();
  }

  function setArchived(site, archived) {
    site.members.forEach(record => { record.archived = archived; });
    save();
    nav();
    render();
    toast(archived ? '网站及其收藏已移除' : '已恢复网站');
  }

  function archiveSite(site) {
    setArchived(site, true);
    const undo = document.createElement('button');
    undo.textContent = '撤销';
    undo.onclick = () => setArchived(site, false);
    document.querySelector('#toast').append(undo);
  }

  list.addEventListener('click', event => {
    const button = event.target.closest('[data-site-add], [data-site-edit], [data-site-delete]');
    if (!button) return;
    const site = findSite(button.dataset.siteAdd ?? button.dataset.siteEdit ?? button.dataset.siteDelete);
    if (!site) return;
    if (button.hasAttribute('data-site-add')) addToCart(site);
    if (button.hasAttribute('data-site-edit')) editSite(site);
    if (button.hasAttribute('data-site-delete')) archiveSite(site);
  });

  async function refreshIcon(image, container, site) {
    image.style.visibility = 'hidden';
    container.classList.add('icon-fallback');
    if (iconLookups.has(site.domain)) return;
    iconLookups.add(site.domain);
    try {
      const { icon } = await h.readMetadata(site.url);
      if (!icon) return;
      const state = getState();
      state.siteOverrides ||= {};
      state.siteOverrides[site.domain] = { ...state.siteOverrides[site.domain], icon };
      save();
      image.onerror = () => { image.style.visibility = 'hidden'; };
      image.src = icon;
      image.style.visibility = 'visible';
    } catch {}
  }

  h.openSiteEditor = id => { const site = findSite(id); if (site) editSite(site); };
  h.decorateRows = () => {
    list.querySelectorAll('.resource-row').forEach(row => {
      if (row.querySelector('.site-row-actions')) return;
      const site = findSite(row.dataset.site);
      if (!site) return;
      const { id, name, url, icon } = site;
      const container = row.querySelector('.resource-icon');
      container.innerHTML = `<img src="${escape(icon || new URL('/favicon.ico', url).href)}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
      const image = container.querySelector('img');
      image.onerror = () => refreshIcon(image, container, site);
      const actions = document.createElement('div');
      actions.className = 'site-row-actions';
      actions.innerHTML = `<button data-site-add="${escape(id)}" aria-label="加入待选 ${escape(name)}" title="加入待选">＋</button>
        <button data-site-edit="${escape(id)}" aria-label="修改 ${escape(name)} 名称与域名" title="修改名称与域名">✎</button>
        <button data-site-delete="${escape(id)}" aria-label="删除 ${escape(name)}" title="删除网站">×</button>`;
      row.append(actions);
    });
  };
  return h;
}
