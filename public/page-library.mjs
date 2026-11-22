import { uploadFile } from './native-controls.mjs';
import { icon } from './icons.mjs';
import { favoriteButton } from './favorite-button.mjs';
import { bindButtonPress } from './springs.mjs';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

const CATEGORIES = ['浏览全部', '作品集', 'Dashboard', 'SaaS', '电商与品牌', '品牌与机构', '实验与动效', '内容与行业'];
const isPage = (item) => !item.archived && (item.caseType === '网页参考' || Boolean(item.pageCategory));
const detect = (item) => item.pageCategory || '内容与行业';
const promptLabel = (item) => item.promptKind === 'original' ? 'MCP 原始提示词' : item.promptKind === 'reference' ? '设计参考' : item.promptKind === 'user-edited' || item.promptKind === 'user' ? '我的提示词' : '复刻任务';
const SOURCE_PRIORITY = ['21st.dev', 'Framer', 'MotionSites'];

export const pageSource = (item) => item.sourceShort || item.collectionSource?.name || item.source || '其他来源';

export function mixPageSources(items) {
  const groups = new Map();
  for (const item of items) {
    const source = pageSource(item);
    if (!groups.has(source)) groups.set(source, []);
    groups.get(source).push(item);
  }
  for (const group of groups.values()) group.sort((a, b) =>
    String(a.originalName || a.name || '').localeCompare(String(b.originalName || b.name || ''), 'en', { numeric: true, sensitivity: 'base' })
  );
  const sources = [...groups.keys()].sort((a, b) => {
    const ai = SOURCE_PRIORITY.indexOf(a);
    const bi = SOURCE_PRIORITY.indexOf(b);
    return (ai < 0 ? SOURCE_PRIORITY.length : ai) - (bi < 0 ? SOURCE_PRIORITY.length : bi) || a.localeCompare(b, 'en');
  });
  const mixed = [];
  for (let index = 0; mixed.length < items.length; index += 1) {
    for (const source of sources) {
      const item = groups.get(source)[index];
      if (item) mixed.push(item);
    }
  }
  return mixed;
}

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
  const filtered = () => mixPageSources(rows().filter((item) =>
    (category === '浏览全部' || detect(item) === category) &&
    (source === '全部来源' || pageSource(item) === source) &&
    (!query || [item.name, item.originalName, item.sourceCategory, item.sourceShort, item.prompt]
      .join(' ').toLowerCase().includes(query.toLowerCase()))
  ));

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

  function card(item) {
    return `<article class="page-reference">
      <div class="favorite-surface"><button class="page-reference-media" data-open-page="${esc(item.id)}">${preview(item)}</button>
      ${favoriteButton('page', item, item.favorite)}
      <button class="card-action card-action--cart" data-project-ref="${esc(item.id)}" aria-label="加入待选 ${esc(item.name)}">${icon('plus')}</button></div>
      <h3><button data-open-page="${esc(item.id)}">${esc(item.name)}</button></h3>
      <div class="page-reference-meta"><span>${esc(detect(item))}</span><span>${esc(item.sourceShort || item.source || '手动收藏')}</span><span>${esc(promptLabel(item))}</span></div>
    </article>`;
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
    const list = filtered();
    host.innerHTML = list.length ? list.map(card).join('') : '<div class="empty">这个分类还没有页面。</div>';
    wireCards(host);
    if (!list.length || !('ResizeObserver' in window)) return;

    const cards = [...host.querySelectorAll('.page-reference')];
    const track = 4;
    const gap = 20;
    const setSpan = (card, height) => {
      const span = `span ${Math.ceil((height + gap) / track)}`;
      if (card.style.gridRowEnd !== span) card.style.gridRowEnd = span;
    };
    const heights = cards.map(card => card.getBoundingClientRect().height);
    cards.forEach((card, index) => setSpan(card, heights[index]));
    host.style.setProperty('--page-grid-track', `${track}px`);
    host.dataset.masonry = '';
    cardSizes = new ResizeObserver(entries => {
      for (const entry of entries) {
        setSpan(entry.target, entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height);
      }
    });
    cards.forEach(card => cardSizes.observe(card));
  }

  function render() {
    const sources = [...new Set(rows().map(pageSource))].sort((a, b) => {
      const ai = SOURCE_PRIORITY.indexOf(a);
      const bi = SOURCE_PRIORITY.indexOf(b);
      return (ai < 0 ? SOURCE_PRIORITY.length : ai) - (bi < 0 ? SOURCE_PRIORITY.length : bi) || a.localeCompare(b, 'en');
    });
    page.innerHTML = `<div class="page-heading"><h1>页面库</h1><button class="primary" id="page-add">${icon('plus')}添加页面</button></div>
      <div class="component-layout page-library-layout">
        <nav class="component-categories" aria-label="页面分类">
          ${CATEGORIES.map((name) => `<button data-page-cat="${name}" class="${category === name ? 'active' : ''}">${name}<small>${name === '浏览全部' ? rows().length : rows().filter((item) => detect(item) === name).length}</small></button>`).join('')}
        </nav>
        <section>
          <div class="page-library-search"><input id="page-search" data-command-search aria-label="搜索页面" placeholder="搜索页面、来源或提示词" value="${esc(query)}"><label class="page-source-filter"><span>来源分类</span><select id="page-source" aria-label="按来源筛选页面"><option>${'全部来源'}</option>${sources.map((name) => `<option${source === name ? ' selected' : ''}>${esc(name)}</option>`).join('')}</select></label></div>
          <div class="page-reference-grid"></div>
        </section>
      </div>`;

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

  return { show, leave, open: openPage, count: () => rows().length, get showing() { return showing; } };
}
