import { componentWebUrl, referenceMedia } from './component-workspace.mjs';
import { renderDetailMediaStage } from './component-detail-preview.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const sourceFiles = /\.(?:html?|css|[cm]?js|tsx?|jsx|vue|svelte|json|md|txt)$/i;
const privatePreview = /^\/api\/component-previews\/[a-f0-9]{64}(?:\.html)?$/;

export async function componentRequest(action, fields) {
  const response = action === 'get'
    ? await fetch('/api/component-records?' + new URLSearchParams({ id: fields.id }))
    : await fetch('/api/component-records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...fields }),
    });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '组件操作失败');
  return result;
}

export function generatedPreview(record, { card = false, waiting = false } = {}) {
  if (record.preview?.kind !== 'html' || !privatePreview.test(record.preview.url)) return '';
  return `<iframe ${card ? 'tabindex="-1" loading="lazy"' : 'class="component-live"'}${waiting ? ' style="visibility:hidden"' : ''} title="${escape(record.name || '组件')} 交互预览" sandbox="allow-scripts" referrerpolicy="no-referrer" src="${escape(record.preview.url)}"></iframe>`;
}

export function referenceHandoff(record, source = record.sourcePageUrl || record.url) {
  const url = componentWebUrl(source);
  return `请为我在本地 Ilia 中保存的组件「${record.name}」查找预览素材。\n组件 ID：${record.id}\n具体组件页面：${url}\n请核对该页的交互和素材，找出明确展示这个组件的图片或演示视频。优先使用原作者公开的素材。通过本地 Ilia MCP 提交素材候选，保留媒体链接、具体出处页面和一行说明。视频有对应封面时提供 poster，有可核对的尺寸时提供 width 和 height。我会在详情的「参考素材」里选择用于展示的候选。找不到时请说明检查了哪里。`;
}

export function renderLocalPreviewCandidates(root, record, sourceUrl, { refresh, select, copy }) {
  const source = componentWebUrl(sourceUrl);
  const candidates = Array.isArray(record.previewCandidates) ? record.previewCandidates : [];
  root.insertAdjacentHTML('beforeend', `<section class="component-reference-tools" aria-label="本机素材候选">
      <h3>本机素材候选</h3>
      ${source ? `<div class="component-reference-actions"><button type="button" data-find-reference>复制给 Agent 的查找任务</button><button type="button" data-refresh-references>刷新候选</button></div>` : ''}
      <p class="component-workspace-status" role="status"></p>
      ${candidates.length ? `<div class="component-reference-list">${candidates.map(candidate => {
        const citation = componentWebUrl(candidate.sourcePageUrl);
        const selected = candidate.id === record.referencePreview?.id;
        return `<article class="component-reference-item"${selected ? ' tabindex="-1" data-current-reference aria-label="正在展示的预览候选"' : ''}>
          ${renderDetailMediaStage(referenceMedia(candidate, candidate.label || record.name), candidate)}
          <p>${escape(candidate.label || (candidate.kind === 'video' ? '演示视频' : '参考图片'))}</p>
          <div class="component-reference-actions">
            ${citation ? `<a href="${escape(citation)}" target="_blank" rel="noopener noreferrer">素材出处 ↗</a>` : ''}
            <button type="button" data-select-reference="${escape(candidate.id)}" ${selected ? 'disabled' : ''}>${selected ? '正在展示' : '用作预览'}</button>
          </div>
        </article>`;
      }).join('')}</div>` : `<div class="empty">${source ? '还没有参考素材。让 Agent 查看组件原页，再刷新这里。' : '添加组件来源链接后，即可交给 Agent 查找素材。'}</div>`}
    </section>`);
  const status = root.querySelector('[role="status"]');
  let pending = false;
  async function perform(button, action, text) {
    if (pending) return;
    pending = true;
    const focused = document.activeElement === button;
    button.disabled = true;
    status.textContent = text;
    try { await action(); } catch (error) { status.textContent = error.message; }
    finally {
      button.disabled = false;
      pending = false;
      if (focused && button.isConnected && document.activeElement === document.body) button.focus({ preventScroll: true });
    }
  }
  root.querySelector('[data-find-reference]')?.addEventListener('click', () => copy(referenceHandoff(record, source)));
  root.querySelector('[data-refresh-references]')?.addEventListener('click', event => perform(event.currentTarget, refresh, '读取候选中…'));
  root.querySelectorAll('[data-select-reference]').forEach(button => button.addEventListener('click', () => perform(button, () => select(button.dataset.selectReference), '保存所选预览…')));
}

export function openComponentForm(dialog, { categories, category, record, onSaved }) {
  const editing = Boolean(record);
  dialog.innerHTML = `<div class="component-workspace-layout"><form id="component-add" class="component-workspace">
    <div class="dialog-heading"><h2 id="component-dialog-title">${editing ? '编辑组件' : '添加组件'}</h2><button type="button" data-close aria-label="关闭">×</button></div>
    <fieldset class="component-input-mode"><legend class="sr-only">添加方式</legend>
      <label><input type="radio" name="mode" value="source" checked><span>粘贴代码</span></label>
      <label><input type="radio" name="mode" value="link"><span>粘贴链接</span></label>
    </fieldset>
    <label>组件名称<input name="name" maxlength="150" autocomplete="off" value="${escape(record?.name)}"></label>
    <label>原网页链接<input name="url" type="url" placeholder="https://…" value="${escape(record?.url)}"></label>
    <label>组件分类<select name="category">${categories.map(name => `<option${name === category ? ' selected' : ''}>${escape(name)}</option>`).join('')}</select></label>
    <div class="component-input-source">
      <label>代码格式<select name="framework"><option value="">自动识别</option><option value="html" ${record?.framework === 'html' ? 'selected' : ''}>HTML / CSS / JavaScript</option><option value="react" ${record?.framework === 'react' ? 'selected' : ''}>React JSX / TSX</option></select></label>
      <label>组件代码<textarea name="code" rows="8" spellcheck="false" placeholder="${editing ? '留空保留当前源码。' : '粘贴完整 HTML，或粘贴 React JSX / TSX 组件代码。'}"></textarea></label>
      <label class="compact-file-control"><span>添加源码文件</span><input name="files" type="file" multiple accept=".html,.htm,.css,.js,.mjs,.cjs,.tsx,.jsx,.ts,.vue,.svelte,.json,.md,.txt"></label>
    </div>
    <p data-link-help hidden>保存链接后，在「参考素材」把组件交给 Agent 查找图片或视频。</p>
    <details class="component-input-meta"><summary>提示词与许可</summary>
      <label>提示词原文<textarea name="prompt" rows="4">${escape(record?.prompt)}</textarea></label>
      <label>源码许可<input name="license" autocomplete="off" value="${escape(record?.license)}" placeholder="例如 MIT，或留空待确认"></label>
    </details>
    <div class="component-reference-actions"><button type="button" data-preview-source>预览代码</button><button class="primary" type="submit">${editing ? '保存修改' : '保存组件'}</button></div>
    <p class="component-workspace-status" role="status"></p>
  </form><section class="component-workspace-result" data-preview-result aria-label="代码预览" hidden></section></div>`;
  const form = dialog.querySelector('form');
  const { name, url, code, framework, files } = form.elements;
  const submit = form.querySelector('[type="submit"]');
  const preview = form.querySelector('[data-preview-source]');
  const status = form.querySelector('[role="status"]');
  const output = dialog.querySelector('[data-preview-result]');
  const sourceInput = form.querySelector('.component-input-source');
  const getMode = () => form.elements.mode.value;
  let busy = false;
  let inputRevision = 0;
  const applyMode = () => {
    const link = getMode() === 'link';
    sourceInput.hidden = link;
    preview.hidden = link;
    form.querySelector('[data-link-help]').hidden = !link;
    name.required = !link;
    url.required = link;
    url.placeholder = link ? '粘贴具体组件的链接' : '可选，填写组件来源';
    invalidatePreview();
  };
  function invalidatePreview() {
    inputRevision++;
    output.replaceChildren();
    output.hidden = true;
    if (!busy) status.textContent = '';
  }
  form.elements.mode[editing && record.url && !record.filePackage && !record.files?.length ? 1 : 0].checked = true;
  form.querySelectorAll('[name="mode"]').forEach(input => input.addEventListener('change', applyMode));
  [code, files, framework].forEach(input => input.addEventListener('input', invalidatePreview));
  form.querySelector('[data-close]').onclick = () => dialog.close();
  applyMode();
  if (!dialog.open) dialog.showModal();

  async function readSources(mode, pasted, language) {
    if (mode !== 'source') return undefined;
    const attachments = [...files.files];
    if (attachments.some(file => file.size > 3 * 1024 * 1024)) throw new Error('单个文件请小于 3 MB。');
    if (attachments.some(file => !sourceFiles.test(file.name))) throw new Error('请上传文本格式的源码文件。');
    const result = new Map(await Promise.all(attachments.map(async file => [file.name, await file.text()])));
    if (pasted.trim()) result.set(language === 'react' ? 'Preview.tsx' : 'index.html', pasted);
    return [...result].map(([name, content]) => ({ name, content }));
  }
  async function perform(kind) {
    if (busy) return;
    busy = true;
    submit.disabled = preview.disabled = true;
    const revision = inputRevision;
    try {
      const values = new FormData(form);
      const mode = getMode();
      const pasted = code.value;
      const language = framework.value || (pasted.trim() ? (/^\s*</.test(pasted) ? 'html' : 'react') : undefined);
      let sources = await readSources(mode, pasted, language);
      if (mode === 'source' && !sources.length && (kind === 'preview' || !editing)) throw new Error('请粘贴或上传源码。');
      status.textContent = kind === 'preview' ? '生成预览中…' : '保存中…';
      if (editing && sources?.length && record.filePackage) {
        const response = await fetch('/api/component-package?' + new URLSearchParams({ id: record.filePackage }));
        if (!response.ok) throw new Error('读取现有源码失败，本次修改还未提交。');
        const { files: previous } = await response.json();
        sources = [...new Map([...previous, ...sources].map(file => [file.name, file])).values()];
      }
      if (kind === 'preview') {
        const result = await componentRequest('preview', { files: sources, framework: language });
        if (revision !== inputRevision || !dialog.open || !form.isConnected) return;
        status.textContent = result.message || '';
        output.innerHTML = generatedPreview({ name: name.value, preview: result.preview }, { waiting: true });
        const frame = output.querySelector('iframe');
        if (!frame) return;
        output.hidden = false;
        frame.addEventListener('load', () => {
          if (revision !== inputRevision || !frame.isConnected) return;
          frame.style.visibility = '';
          if (matchMedia('(max-width: 760px)').matches) output.scrollIntoView({ block: 'start', behavior: 'instant' });
        }, { once: true });
        return;
      }
      const { record: saved } = await componentRequest('save', {
        ...(editing ? { id: record.id, componentRevision: record.componentRevision } : {}),
        name: values.get('name'),
        url: values.get('url'),
        category: values.get('category'),
        prompt: values.get('prompt'),
        license: values.get('license'),
        ...(sources?.length ? { files: sources, framework: language } : {}),
      });
      await onSaved(saved, dialog.open && form.isConnected);
    } catch (error) { status.textContent = error.message; }
    finally { busy = false; submit.disabled = preview.disabled = false; }
  }
  preview.onclick = () => perform('preview');
  form.onsubmit = event => { event.preventDefault(); perform('save'); };
}
