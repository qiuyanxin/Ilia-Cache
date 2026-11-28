import {
  filterPageReferences, PAGE_CATEGORIES as CATEGORIES, pagePromptLabel as promptLabel,
  renderPageLibrary, renderPageReferenceCards, sizePageReferences,
} from './page-library-view.mjs';
import { isPageRecord as isPage } from './page-taxonomy.mjs';
import { uploadFile } from './native-controls.mjs';
import { icon } from './icons.mjs';
import { favoriteButton } from './favorite-button.mjs';
import { bindButtonPress } from './springs.mjs';
import { localImageAttachment } from './reference-media-model.mjs';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

const dashboardPreviews = {
  'page-dashboard-open-tabler': { image: 'tabler' },
  'page-dashboard-open-orbynadmin': { image: 'orbynadmin', demo: '' },
  'page-dashboard-open-kiranism-next-shadcn': { demo: '', site: 'https://shadcn-dashboard.kiranism.dev/' },
  'page-dashboard-open-shadcn-dashboard': { image: 'shadcn-dashboard' },
  'page-dashboard-open-tailadmin-react': { image: 'tailadmin-react', demo: 'https://free-react-demo.tailadmin.com/' },
  'page-dashboard-open-admin-one': { image: 'admin-one', demo: 'https://justboil.github.io/admin-one-react-tailwind/dashboard' },
};

function webUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function sourceAsset(url) {
  return typeof url === 'string' && /^\/api\/assets\/[a-f0-9-]+\.[a-z0-9]+$/.test(url);
}

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
  let embedRequest;

  const rows = () => h.getState().resources.filter(isPage);
  const filtered = () => filterPageReferences(rows(), { category, source, query, favoritesFirst: true });

  function preview(item) {
    const dashboard = dashboardPreviews[item.id];
    if (dashboard?.image) return `<img src="${esc(mediaUrl(item))}" alt="${esc(item.name)} 后台首页" loading="lazy">`;
    if (dashboard) return '<span class="page-preview-unavailable">演示需要登录，暂无后台截图</span>';
    const localCover = item.media?.find(media => media.type === 'image' && localImageAttachment.test(media.url));
    if (localCover) return `<img src="${esc(localCover.url)}" alt="${esc(item.name)} 页面预览" loading="lazy">`;
    const html = h.cardMedia(item).replace(/<\/?a\b[^>]*>/g, '');
    if (!/case-media-empty/.test(html)) return html;
    let domain = '';
    try { domain = new URL(item.url).hostname.replace(/^www\./, ''); } catch {}
    return `<img src="${esc(h.screenshot({ url: item.url, domain }))}" alt="${esc(item.name)} 页面预览" loading="lazy" referrerpolicy="no-referrer">`;
  }

  function mediaUrl(item) {
    const cover = dashboardPreviews[item.id]?.image;
    return cover ? `/previews/dashboard/${cover}.webp` : item.media?.find((media) => media.type === 'image')?.url || item.preview || '';
  }

  function cardActions(item) {
    return favoriteButton('page', item, item.favorite) +
      `<button class="card-action card-action--cart" data-project-ref="${esc(item.id)}" aria-label="加入项目 ${esc(item.name)}">${icon('plus')}</button>`;
  }

  function wireCards(host = page) {
    host.querySelectorAll('[data-open-page]').forEach((button) => {
      button.onclick = () => openPage(button.dataset.openPage);
    });
    host.querySelectorAll('[data-project-ref]').forEach((button) => {
      button.onclick = () => {
        const item = h.getState().resources.find((entry) => entry.id === button.dataset.projectRef);
        if (!item) return;
        h.projects?.addReference({
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
    page.innerHTML = renderPageLibrary(rows(), { category, source, query, canAdd: false });

    page.querySelectorAll('[data-page-cat]').forEach((button) => {
      button.onclick = () => { category = button.dataset.pageCat; render(); };
    });
    page.querySelector('#page-search').oninput = (event) => {
      query = event.target.value;
      renderResults();
    };
    page.querySelectorAll('[data-page-source]').forEach((button) => {
      button.onclick = () => {
        source = button.dataset.pageSource;
        page.querySelectorAll('[data-page-source]').forEach((choice) => {
          choice.setAttribute('aria-pressed', String(choice === button));
        });
        renderResults();
      };
    });
    renderResults();
  }

  function openPage(id) {
    const item = h.getState().resources.find((entry) => entry.id === id);
    if (!item) return;
    embedRequest?.abort();
    const sourceUrl = webUrl(item.primarySourceUrl) || webUrl(item.url);
    const demoUrl = webUrl(dashboardPreviews[id]?.demo ?? item.livePreview);
    const originalUrl = demoUrl || webUrl(dashboardPreviews[id]?.site ?? item.url) || sourceUrl;
    const link = (url, label) => url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>` : '';
    const sourceName = item.sourceShort || item.source || '来源';
    const sourceLabel = item.primarySourceKind === 'repository' ? '查看源码' :
      ['Framer', '21st.dev'].includes(sourceName) ? `${sourceName} 模板页` : `${sourceName} 来源页`;
    const hasPrompt = Boolean(item.prompt?.trim());
    const archive = item.pageSourceArchive;
    const sourceFiles = Array.isArray(archive?.files) ? archive.files.filter(file => sourceAsset(file?.url)) : [];
    dialog.innerHTML = `<div class="dialog-heading"><h2>${esc(item.name)}</h2><button type="button" data-close aria-label="关闭">${icon('close')}</button></div>
      <div class="component-detail-actions">${link(sourceUrl, sourceLabel)}${originalUrl !== sourceUrl ? link(originalUrl, demoUrl ? '打开演示站' : '打开原站') : ''}<button id="page-project" type="button">加入项目</button></div>
      ${demoUrl ? '<div class="page-preview-controls"><button id="page-demo" class="outline" type="button" aria-pressed="false" aria-describedby="page-demo-hint">在线演示</button><span id="page-demo-hint" role="status"></span></div>' : ''}
      <div class="page-detail-media"><div data-page-poster>${preview(item)}</div></div>
      ${sourceAsset(archive?.url) ? `<details class="page-local-source"><summary>本机源码</summary>
        <a href="${esc(archive.url)}" download="${esc(archive.name)}">下载完整源码 ZIP</a>
        <span>${esc(item.license)} · ${esc(archive.fileCount)} 个文件</span>
        ${sourceFiles.length ? `<div class="page-source-controls"><select aria-label="源码文件" data-anchored-select>${sourceFiles.map((file, index) => `<option value="${index}">${esc(file.name)}</option>`).join('')}</select><button type="button" class="outline" disabled>复制文件</button></div><pre></pre>` : ''}
      </details>` : ''}
      ${hasPrompt ? `<div class="page-prompt"><details><summary>${esc(promptLabel(item))}</summary><pre>${esc(item.prompt)}</pre></details><button id="page-copy" class="outline" type="button">复制提示词</button></div>` : ''}
      <details class="page-detail-menu"><summary>更多</summary><div class="component-detail-actions"><button id="page-edit-prompt" type="button">${hasPrompt ? '编辑我的提示词' : '添加提示词'}</button><button id="page-delete" class="quiet" type="button">移除页面</button></div></details>
      <div class="page-prompt-editor" hidden><label>我的提示词<textarea rows="8">${esc(item.prompt || '')}</textarea></label><div class="dialog-actions"><button id="page-cancel-prompt" class="quiet" type="button">取消</button><button id="page-save-prompt" class="primary" type="button">保存提示词</button></div></div>`;
    dialog.querySelector('[data-close]').onclick = () => dialog.close();
    if (demoUrl) bindLivePreview(item.name, demoUrl);
    const localSource = dialog.querySelector('.page-local-source');
    if (localSource && sourceFiles.length) {
      const select = localSource.querySelector('select');
      const code = localSource.querySelector('pre');
      const copy = localSource.querySelector('button');
      let request = 0;
      async function readFile() {
        const current = ++request;
        copy.disabled = true;
        code.textContent = '正在读取文件…';
        try {
          const response = await fetch(sourceFiles[select.value].url);
          if (!response.ok) throw new Error('读取失败');
          const content = await response.text();
          if (current !== request) return;
          code.textContent = content;
          copy.disabled = false;
        } catch {
          if (current === request) code.textContent = '暂时无法读取该文件，请下载完整源码。';
        }
      }
      localSource.ontoggle = () => { if (localSource.open && !request) readFile(); };
      select.onchange = readFile;
      copy.onclick = () => h.copy(code.textContent);
    }
    const editor = dialog.querySelector('.page-prompt-editor');
    const prompt = editor.querySelector('textarea');
    const edit = dialog.querySelector('#page-edit-prompt');
    edit.onclick = () => {
      editor.hidden = false;
      edit.closest('details').open = false;
      prompt.focus();
    };
    dialog.querySelector('#page-cancel-prompt').onclick = () => {
      editor.hidden = true;
      prompt.value = item.prompt || '';
      edit.closest('details').open = true;
      edit.focus();
    };
    bindButtonPress(dialog.querySelector('#page-save-prompt'));
    dialog.querySelector('#page-save-prompt').onclick = () => {
      item.originalPrompt ||= item.prompt || '';
      item.prompt = prompt.value;
      item.promptKind = 'user-edited';
      item.promptStatus = '我的提示词';
      h.save();
      render();
      openPage(id);
      h.toast('提示词已保存');
    };
    if (hasPrompt) dialog.querySelector('#page-copy').onclick = () => h.copy(item.prompt);
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

  function bindLivePreview(name, url) {
    const button = dialog.querySelector('#page-demo');
    const status = dialog.querySelector('.page-preview-controls [role="status"]');
    const poster = dialog.querySelector('[data-page-poster]');
    button.onclick = async () => {
      const frame = poster.parentElement.querySelector('iframe');
      if (frame) {
        frame.remove();
        poster.hidden = false;
        button.textContent = '在线演示';
        button.setAttribute('aria-pressed', 'false');
        status.textContent = '';
        return;
      }
      const request = new AbortController();
      embedRequest = request;
      button.disabled = true;
      status.textContent = '正在检查演示地址…';
      try {
        const response = await fetch('/api/embed-check?url=' + encodeURIComponent(url), { signal: request.signal });
        const result = await response.json();
        if (request.signal.aborted || !dialog.open || !button.isConnected) return;
        if (!response.ok || result.available === false || result.blocked) throw new Error('演示不可嵌入');
        const iframe = document.createElement('iframe');
        iframe.title = name + ' 在线演示';
        iframe.setAttribute('sandbox', 'allow-scripts allow-forms allow-same-origin');
        iframe.referrerPolicy = 'no-referrer';
        iframe.src = url;
        poster.after(iframe);
        poster.hidden = true;
        button.textContent = '返回截图';
        button.setAttribute('aria-pressed', 'true');
        status.textContent = result.available === null ? '若演示无法显示，可返回截图或打开演示站。' : '';
      } catch {
        if (!request.signal.aborted && button.isConnected) status.textContent = '暂时无法嵌入，请打开演示站查看。';
      } finally {
        button.disabled = false;
      }
    };
  }

  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    embedRequest?.abort();
    dialog.querySelector('iframe')?.remove();
  });

  function addPage() {
    dialog.innerHTML = `<form id="page-add-form"><div class="dialog-heading"><h2>添加页面</h2><button type="button" data-close aria-label="关闭">${icon('close')}</button></div>
      <label>页面链接<input name="url" type="url" required placeholder="https://"></label>
      <label>标题<input name="name" placeholder="可留空自动读取"></label>
      <label>分类<select name="category">${CATEGORIES.slice(1).map((name) => `<option>${name}</option>`).join('')}</select></label>
      <details><summary>添加提示词</summary><textarea name="prompt" rows="8" aria-label="提示词"></textarea></details>
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

  return { show, leave, open: openPage, openPage, refreshOrder: () => { if (showing) renderResults(); }, count: () => rows().length, get showing() { return showing; } };
}
