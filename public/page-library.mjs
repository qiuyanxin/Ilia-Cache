import {
  filterPageReferences, PAGE_CATEGORIES as CATEGORIES, pagePromptLabel as promptLabel,
  renderPageLibrary, renderPageReferenceCards, sizePageReferences,
} from './page-library-view.mjs';
import { isPageRecord as isPage } from './page-taxonomy.mjs';
import { uploadFile } from './native-controls.mjs';
import { icon } from './icons.mjs';
import { favoriteButton } from './favorite-button.mjs';
import { bindButtonPress } from './springs.mjs';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

export { isPage };
export { mixPageSources, pageSource } from './page-library-view.mjs';

export function installPageLibrary(h) {
  const page = document.createElement('main');
  page.id = 'page-library';
  page.hidden = true;
  document.querySelector('#component-library').after(page);

  const dialog = document.createElement('dialog');
  dialog.id = 'page-library-dialog';
  document.body.append(dialog);

  let category = '浏览全部';
  let source = '全部来源';
  let query = '';
  let showing = false;
  let cardSizes;

  const rows = () => h.getState().resources.filter(isPage);
  const filtered = () => filterPageReferences(rows(), { category, source, query });

  function preview(item) {
    const html = h.cardMedia(item).replace(/<\/?a\b[^>]*>/g, '');
    if (!/case-media-empty/.test(html)) return html;
    let domain = '';
    try { domain = new URL(item.url).hostname.replace(/^www\./, ''); } catch {}
    return `<img src="${esc(h.screenshot({ url: item.url, domain }))}" alt="${esc(item.name)} 页面预览" loading="lazy" referrerpolicy="no-referrer">`;
  }

  function mediaUrl(item) {
    return item.media?.find((media) => media.type === 'image')?.url || item.preview || '';
  }

  function cardActions(item) {
    return favoriteButton('page', item, item.favorite) +
      `<button class="card-action card-action--cart" data-project-ref="${esc(item.id)}" aria-label="加入待选 ${esc(item.name)}">${icon('plus')}</button>`;
  }

  function wireCards(host = page) {
    host.querySelectorAll('[data-open-page]').forEach((button) => {
      button.onclick = () => openPage(button.dataset.openPage);
    });
    host.querySelectorAll('[data-project-ref]').forEach((button) => {
      button.onclick = () => {
        const item = h.getState().resources.find((entry) => entry.id === button.dataset.projectRef);
        if (!item) return;
        h.projects?.addReferenceToCart({
          id: `page:${item.id}`,
          type: 'page',
          resourceId: item.id,
          name: item.name,
          image: mediaUrl(item),
          url: item.url,
        });
      };
    });

  }

  function renderResults() {
    const host = page.querySelector('.page-reference-grid');
    if (!host) return;
    cardSizes?.disconnect();
    host.removeAttribute('data-masonry');
    host.innerHTML = renderPageReferenceCards(filtered(), { preview, actions: cardActions });
    wireCards(host);
    cardSizes = sizePageReferences(host);
  }

  function render() {
    page.innerHTML = renderPageLibrary(rows(), { category, source, query, canAdd: true });

    page.querySelectorAll('[data-page-cat]').forEach((button) => {
      button.onclick = () => { category = button.dataset.pageCat; render(); };
    });
    page.querySelector('#page-search').oninput = (event) => {
      query = event.target.value;
      renderResults();
    };
    page.querySelector('#page-source').onchange = (event) => {
      source = event.target.value;
      renderResults();
    };
    page.querySelector('#page-add').onclick = addPage;
    renderResults();
  }

  function openPage(id) {
    const item = h.getState().resources.find((entry) => entry.id === id);
    if (!item) return;
    dialog.innerHTML = `<div class="dialog-heading"><div><small>${esc(item.sourceShort || item.source || '手动收藏')} · ${esc(promptLabel(item))}</small><h2>${esc(item.name)}</h2></div><button data-close aria-label="关闭">${icon('close')}</button></div>
      <div class="page-detail-media">${preview(item)}</div>
      <div class="component-detail-actions"><a href="${esc(item.primarySourceUrl || item.url)}" target="_blank" rel="noopener noreferrer">打开动态来源 ↗</a><button id="page-project" type="button">加入项目</button></div>
      <textarea rows="16" aria-label="${esc(promptLabel(item))}">${esc(item.prompt || '')}</textarea>
      <div class="dialog-actions"><button id="page-delete" class="quiet" type="button">移除页面</button><div class="dialog-actions-group"><button id="page-copy" class="outline" type="button">复制提示词</button><button id="page-save-prompt" class="primary" type="button">保存提示词</button></div></div>`;
    dialog.querySelector('[data-close]').onclick = () => dialog.close();
    const prompt = dialog.querySelector('textarea');
    bindButtonPress(dialog.querySelector('#page-save-prompt'));
    dialog.querySelector('#page-save-prompt').onclick = () => {
      item.originalPrompt ||= item.prompt || '';
      item.prompt = prompt.value;
      item.promptKind = 'user-edited';
      item.promptStatus = '我的提示词';
      h.save();
      render();
      h.toast('提示词已保存');
    };
    dialog.querySelector('#page-copy').onclick = () => h.copy(prompt.value);
    dialog.querySelector('#page-delete').onclick = () => {
      item.archived = true;
      h.save();
      h.refreshFavorites?.();
      h.nav();
      render();
      dialog.close();
      h.toast('页面已移除');
    };
    dialog.querySelector('#page-project').onclick = () => h.projects?.addReference({
      id: `page:${item.id}`,
      type: 'page',
      resourceId: item.id,
      name: item.name,
      image: mediaUrl(item),
      url: item.url,
    });
    if (!dialog.open) dialog.showModal();
  }

  function addPage() {
    dialog.innerHTML = `<form id="page-add-form"><div class="dialog-heading"><h2>添加页面</h2><button type="button" data-close aria-label="关闭">${icon('close')}</button></div>
      <label>页面链接<input name="url" type="url" required placeholder="https://"></label>
      <label>标题<input name="name" placeholder="可留空自动读取"></label>
      <label>分类<select name="category">${CATEGORIES.slice(1).map((name) => `<option>${name}</option>`).join('')}</select></label>
      <label>提示词<textarea name="prompt" rows="8"></textarea></label>
      <label class="compact-file-control">${icon('upload')}<span>选择图片、视频或源码</span><input name="files" type="file" multiple hidden></label>
      <div class="dialog-actions"><button class="primary" type="submit">保存页面</button></div></form>`;
    bindButtonPress(dialog.querySelector('button[type="submit"]'));
    dialog.querySelector('[data-close]').onclick = () => dialog.close();
    dialog.querySelector('form').onsubmit = async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const values = new FormData(form);
      const url = values.get('url');
      if (h.getState().resources.some((item) => !item.archived && item.url === url)) {
        h.toast('这个链接已经收藏');
        return;
      }
      let metadata = {};
      try { metadata = await h.readMetadata(url); } catch {}
      const media = [...(metadata.media || [])];
      const files = [];
      for (const file of [...form.elements.files.files]) {
        if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
          const asset = await uploadFile(file, () => {});
          media.push({ type: file.type.startsWith('video/') ? 'video' : 'image', url: asset.url, poster: asset.poster || '' });
        } else if (file.size < 3 * 1024 * 1024) {
          files.push({ name: file.name, content: await file.text() });
        }
      }
      const item = {
        id: crypto.randomUUID(),
        name: values.get('name').trim() || metadata.title?.split(/[|｜]/)[0] || new URL(url).hostname,
        url,
        category: '页面模板',
        kind: '案例',
        caseType: '网页参考',
        pageCategory: values.get('category'),
        prompt: values.get('prompt'),
        promptKind: 'user',
        promptStatus: '我的提示词',
        source: '手动收藏',
        sourceShort: '我的收藏',
        media,
        files,
        tags: [values.get('category')],
        cost: '',
        gets: '参考',
        created: new Date().toISOString(),
      };
      h.getState().resources.unshift(item);
      h.save();
      h.nav();
      dialog.close();
      render();
      h.toast('已加入页面库');
    };
    if (!dialog.open) dialog.showModal();
  }

  function show() {
    showing = true;
    for (const id of ['library', 'learning', 'component-library', 'collection-pages', 'projects-page', 'font-library', 'home-page', 'sources-page']) {
      document.getElementById(id)?.setAttribute('hidden', '');
    }
    page.hidden = false;
    document.querySelector('#breadcrumb').textContent = '页面库';
    render();
  }

  function leave() {
    cardSizes?.disconnect();
    showing = false;
    page.hidden = true;
  }

  return { show, leave, open: openPage, openPage, count: () => rows().length, get showing() { return showing; } };
}
