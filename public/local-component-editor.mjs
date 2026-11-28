import { componentWebUrl, referenceMedia } from './component-workspace.mjs';
import { renderDetailMediaStage } from './component-detail-preview.mjs';
import { COMPONENT_BROWSE_GROUPS, componentBrowseCategory } from './component-categories.mjs';
import { registryComponentPage } from './registry-component.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const sourceFiles = /\.(?:html?|css|[cm]?js|tsx?|jsx|vue|svelte|json|md|txt)$/i;
const privatePreview = /^\/api\/component-previews\/[a-f0-9]{64}(?:\.html)?$/;

function cleanDetectedName(value) {
  return String(value || '').split(/\s+[|｜·—–]\s+/)[0].trim().slice(0, 150);
}

export function registryDisplayName(value) {
  return String(value || '').replace(/[-_]+/g, ' ').replace(/\b[a-z]/g, letter => letter.toUpperCase()).trim().slice(0, 150);
}

function nameFromSources(files = []) {
  const preferred = files.find(file => /\.(?:tsx?|jsx?|vue|svelte|html?)$/i.test(file.name)) || files[0];
  const code = files.map(file => file.content || '').join('\n');
  const declared = code.match(/(?:export\s+default\s+)?(?:function|class)\s+([A-Z][\w$]*)\b/)?.[1] ||
    code.match(/(?:export\s+(?:default\s+)?)?(?:const|let|var)\s+([A-Z][\w$]*)\s*=/)?.[1];
  if (declared) return declared.replace(/([a-z\d])([A-Z])/g, '$1 $2');
  return preferred?.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || '';
}

function looksLikeReact(code) {
  return /\b(?:from\s+['"]react['"]|React\.|createRoot\s*\(|export\s+default\s+(?:function|class)|return\s*\(?\s*<[A-Za-z])/m.test(code);
}

function frameworkFromSources(files = []) {
  if (files.some(file => /\.(?:tsx|jsx)$/i.test(file.name))) return 'react';
  const code = files.map(file => file.content || '').join('\n');
  if (looksLikeReact(code)) return 'react';
  if (files.some(file => /\.html?$/i.test(file.name))) return 'html';
  return /^\s*</.test(code) ? 'html' : undefined;
}

const dependencyName = specifier => specifier.startsWith('@')
  ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];

export function sourceMetadataFromFiles(files = []) {
  const code = files.map(file => file.content || '').join('\n');
  const annotation = key => code.match(new RegExp(`@${key}\\s*:?\\s*([^\\n*]+)`, 'i'))?.[1]?.trim() || '';
  const dependencies = [...code.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["']([^"']+)["']/g)]
    .map(match => match[1]).filter(value => !value.startsWith('.') && !value.startsWith('/') && !value.startsWith('@/'))
    .map(dependencyName).filter(value => value && value !== 'react' && value !== 'react-dom');
  return {
    title: annotation('description'),
    author: annotation('author'),
    license: annotation('license'),
    website: annotation('website'),
    dependencies: [...new Set(dependencies)],
  };
}

function sourcePageFromMetadata(metadata) {
  if (!metadata.website) return '';
  try {
    return new URL(metadata.website).href;
  } catch { return ''; }
}

function broadCategoryFromIdentity(value) {
  if (/图片对比|轮播|相册|图集|画廊|image[- ]compare|carousel|gallery|slideshow/i.test(value)) return '图片、图集与轮播';
  if (/开关|按钮|输入|上传|选择|调节|switch|toggle|button|input|upload|slider/i.test(value)) return '按钮与表单';
  if (/导航|菜单|nav(?:igation)?|menu|\btabs?\b/i.test(value)) return '导航与菜单';
  if (/弹窗|浮层|对话框|modal|dialog|popover|tooltip/i.test(value)) return '弹窗与浮层';
  if (/加载|反馈|进度|loading|loader|progress|success|error/i.test(value)) return '加载与反馈';
  if (/光标|拖拽|cursor|drag|drop/i.test(value)) return '光标与拖拽';
  if (/图表|数据|chart|graph|counter|meter/i.test(value)) return '图表与数据';
  if (/文字|排版|打字|text|type|typography/i.test(value)) return '文字与排版';
  if (/滚动|转场|scroll|transition/i.test(value)) return '滚动与页面切换';
  if (/背景|材质|着色器|background|shader|texture/i.test(value)) return '背景与材质';
  return '卡片与列表';
}

export function inferComponentDetails({ name = '', url = '', files = [], framework = '', metadata = {} } = {}) {
  let fallback = '';
  try { fallback = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).at(-1) || ''); } catch {}
  const detectedName = cleanDetectedName(name) || cleanDetectedName(metadata.title) || nameFromSources(files) ||
    cleanDetectedName(fallback.replace(/[-_]+/g, ' '));
  const detectedFramework = framework || frameworkFromSources(files);
  const category = componentBrowseCategory({
    name: detectedName,
    url,
    componentCategory: broadCategoryFromIdentity(`${detectedName} ${url}`),
  });
  return { name: detectedName, framework: detectedFramework, category };
}

async function readLinkMetadata(url) {
  const response = await fetch('/api/metadata', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '暂时无法自动读取网页信息');
  return result;
}

async function readRegistryCommand(command) {
  const response = await fetch('/api/component-registry', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '暂时无法读取组件 Registry');
  return result.registry;
}

async function adoptDetectedPreview(record, metadata, sourcePageUrl) {
  if (record.referencePreview || !Array.isArray(metadata?.media)) return record;
  const media = metadata.media.find(item => item.type === 'video') || metadata.media.find(item => item.type === 'image');
  if (!media?.url) return record;
  const added = await componentRequest('addCandidate', {
    id: record.id,
    candidate: {
      kind: media.type,
      url: media.url,
      ...(media.type === 'video' && media.poster ? { poster: media.poster } : {}),
      sourcePageUrl: metadata.url || sourcePageUrl,
      label: '从组件原页自动识别',
      provenance: '组件原页公开素材',
    },
  });
  const selected = added.record.previewCandidates?.find(item => item.kind === media.type && item.url === media.url);
  return selected ? (await componentRequest('selectCandidate', { id: record.id, candidateId: selected.id })).record : added.record;
}

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
  const source = card ? `data-src="${escape(record.preview.url)}"` : `src="${escape(record.preview.url)}"`;
  return `<iframe ${card ? 'tabindex="-1" loading="lazy"' : 'class="component-live"'}${waiting ? ' style="visibility:hidden"' : ''} title="${escape(record.name || '组件')} 交互预览" sandbox="allow-scripts" referrerpolicy="no-referrer" ${source}></iframe>`;
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

const editorCategoryGroups = {
  ...COMPONENT_BROWSE_GROUPS,
  '摄影与画风': ['摄影与画风'],
  '动画与镜头': ['动画技法', '镜头与剪辑'],
  '音效': ['音效'],
};

function categoryOptions(choices, selected) {
  return choices.map(name =>
    `<option${name === selected ? ' selected' : ''}>${escape(name)}</option>`).join('');
}

export function renderComponentCategoryField(record, category) {
  const selected = record ? componentBrowseCategory(record) : category;
  const group = Object.keys(editorCategoryGroups).find(name => editorCategoryGroups[name].includes(selected)) ||
    (Object.hasOwn(editorCategoryGroups, category) ? category : Object.keys(editorCategoryGroups)[0]);
  return `<div class="component-edit-category-fields">
    <label class="component-category-field">组件分类<select name="categoryGroup" aria-label="组件分类" data-anchored-select>
      ${categoryOptions(Object.keys(editorCategoryGroups), group)}</select></label>
    <label class="component-category-field">细分分类<select name="category" aria-label="细分分类" data-anchored-select>
      ${categoryOptions(editorCategoryGroups[group], selected)}</select></label>
  </div>`;
}

export function bindComponentCategoryField(form) {
  const { categoryGroup, category } = form.elements;
  categoryGroup.addEventListener('change', () => {
    category.innerHTML = categoryOptions(editorCategoryGroups[categoryGroup.value], category.value);
  });
}

export function openComponentForm(dialog, { category, record, initialInput, onSaved }) {
  const editing = Boolean(record);
  const streamlined = Boolean(initialInput && !editing);
  dialog.innerHTML = `<div class="component-workspace-layout${streamlined ? ' is-streamlined' : ''}"><form id="component-add" class="component-workspace">
    <div class="dialog-heading"><h2 id="component-dialog-title">${editing ? '编辑组件' : '添加组件'}</h2><button type="button" data-close aria-label="关闭">×</button></div>
    <fieldset class="component-input-mode"><legend class="sr-only">添加方式</legend>
      <label><input type="radio" name="mode" value="source" checked><span>粘贴代码</span></label>
      <label><input type="radio" name="mode" value="link"><span>粘贴链接</span></label>
      <label><input type="radio" name="mode" value="registry"><span>粘贴安装命令</span></label>
    </fieldset>
    <p class="component-auto-help">只需要提供链接、代码或安装命令，其余信息会自动识别。</p>
    <div class="component-input-source">
      <label>组件代码<textarea name="code" rows="8" spellcheck="false" placeholder="${editing ? '留空保留当前源码。' : '粘贴完整 HTML，或粘贴 React JSX / TSX 组件代码。'}"></textarea></label>
      <label class="compact-file-control"><span>添加源码文件</span><input name="files" type="file" multiple accept=".html,.htm,.css,.js,.mjs,.cjs,.tsx,.jsx,.ts,.vue,.svelte,.json,.md,.txt"></label>
    </div>
    <div class="component-input-registry" hidden>
      <label>安装命令<textarea name="registryCommand" rows="4" spellcheck="false" placeholder="npx shadcn@latest add https://example.com/r/component.json">${escape(record?.installCommand)}</textarea></label>
      <p>只读取公开 Registry，不会在电脑上执行这条命令。</p>
      <p data-registry-summary hidden></p>
    </div>
    <p data-link-help hidden>系统会先读取原页的名称和公开预览素材，之后仍可在详情里更换。</p>
    <div class="component-preview-action"><button type="button" data-preview-source>重新生成预览</button><span>粘贴或上传后会自动识别并预览</span></div>
    <p class="component-workspace-status" role="status"></p>
    <div class="component-input-meta" data-advanced-fields>
      <label data-link-field>原网页链接<input name="url" type="url" placeholder="粘贴具体组件链接" value="${escape(record?.url)}"></label>
      <label>组件名称<input name="name" maxlength="150" autocomplete="off" placeholder="留空自动识别" value="${escape(record?.name)}"></label>
      ${renderComponentCategoryField(record, category)}
      <label data-framework-field>代码格式<select name="framework"><option value="">自动识别</option><option value="html" ${record?.framework === 'html' ? 'selected' : ''}>HTML / CSS / JavaScript</option><option value="react" ${record?.framework === 'react' ? 'selected' : ''}>React JSX / TSX</option></select></label>
    </div>
    <details class="component-input-extra"><summary>提示词与许可（可选）</summary>
      <label>提示词原文<textarea name="prompt" rows="4">${escape(record?.prompt)}</textarea></label>
      <label>源码许可<input name="license" autocomplete="off" value="${escape(record?.license)}" placeholder="只填写原作者明确标注的许可"></label>
    </details>
    <div class="dialog-actions"><button class="primary" type="submit">${editing ? '保存修改' : '保存组件'}</button></div>
  </form><section class="component-workspace-result" data-preview-result aria-label="代码预览" hidden></section></div>`;
  const form = dialog.querySelector('form');
  bindComponentCategoryField(form);
  const { name, url, code, framework, files, license, registryCommand } = form.elements;
  const submit = form.querySelector('[type="submit"]');
  const preview = form.querySelector('[data-preview-source]');
  const status = form.querySelector('[role="status"]');
  const output = dialog.querySelector('[data-preview-result]');
  const sourceInput = form.querySelector('.component-input-source');
  const registryInput = form.querySelector('.component-input-registry');
  const registrySummary = form.querySelector('[data-registry-summary]');
  const advancedFields = form.querySelector('[data-advanced-fields]');
  const linkField = form.querySelector('[data-link-field]');
  const frameworkField = form.querySelector('[data-framework-field]');
  const modeField = form.querySelector('.component-input-mode');
  const autoHelp = form.querySelector('.component-auto-help');
  const previewAction = form.querySelector('.component-preview-action');
  const getMode = () => form.elements.mode.value;
  const initialFiles = Array.isArray(initialInput?.files) ? initialInput.files : [];
  let busy = false;
  let inputRevision = 0;
  let autoPreviewTimer;
  let categoryTouched = editing;
  const setDetectedCategory = detected => {
    const group = Object.keys(editorCategoryGroups).find(name => editorCategoryGroups[name].includes(detected));
    if (!group) return;
    form.elements.categoryGroup.value = group;
    form.elements.categoryGroup.dispatchEvent(new Event('change', { bubbles: true }));
    form.elements.category.value = detected;
    form.elements.category.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const applyMode = () => {
    const mode = getMode();
    const link = mode === 'link';
    const registry = mode === 'registry';
    sourceInput.hidden = streamlined || mode !== 'source';
    registryInput.hidden = streamlined || !registry;
    previewAction.hidden = streamlined;
    preview.hidden = streamlined || link;
    modeField.hidden = streamlined;
    autoHelp.hidden = streamlined;
    form.querySelector('[data-link-help]').hidden = streamlined || !link;
    url.required = link;
    registryCommand.required = registry;
    frameworkField.hidden = streamlined || link;
    linkField.hidden = streamlined || registry;
    if (link) form.querySelector('.component-input-mode').after(linkField);
    else advancedFields.prepend(linkField);
    invalidatePreview();
  };
  function invalidatePreview() {
    inputRevision++;
    output.replaceChildren();
    output.hidden = true;
    registrySummary.hidden = true;
    registrySummary.textContent = '';
    if (!busy) status.textContent = '';
  }
  function schedulePreview(delay = 650) {
    clearTimeout(autoPreviewTimer);
    autoPreviewTimer = setTimeout(() => {
      if (!dialog.open || busy) return;
      const mode = getMode();
      if (mode === 'source' && (code.value.trim() || files.files.length) || mode === 'registry' && registryCommand.value.trim()) perform('preview');
    }, delay);
  }
  form.elements.mode.value = initialInput?.mode || (editing && record.captureMethod === 'registry' ? 'registry' :
    editing && record.url && !record.filePackage && !record.files?.length ? 'link' : 'source');
  if (initialInput?.mode === 'registry') registryCommand.value = initialInput.text || '';
  else if (initialInput?.mode === 'link') url.value = initialInput.text || '';
  else if (initialInput?.text) code.value = initialInput.text;
  form.querySelectorAll('[name="mode"]').forEach(input => input.addEventListener('change', applyMode));
  form.elements.category.addEventListener('change', () => { categoryTouched = true; });
  form.elements.categoryGroup.addEventListener('change', () => { categoryTouched = true; });
  code.addEventListener('input', () => { invalidatePreview(); schedulePreview(); });
  files.addEventListener('change', () => { invalidatePreview(); schedulePreview(0); });
  registryCommand.addEventListener('input', () => { invalidatePreview(); schedulePreview(); });
  framework.addEventListener('input', () => { invalidatePreview(); schedulePreview(); });
  form.querySelector('[data-close]').onclick = () => dialog.close();
  applyMode();
  if (!dialog.open) dialog.showModal();
  if (initialInput && (initialInput.mode === 'source' || initialInput.mode === 'registry')) schedulePreview(0);

  async function readSources(mode, pasted, language) {
    if (mode !== 'source') return undefined;
    const attachments = [...initialFiles, ...files.files];
    if (attachments.some(file => file.size > 3 * 1024 * 1024)) throw new Error('单个文件请小于 3 MB。');
    if (attachments.some(file => !sourceFiles.test(file.name))) throw new Error('请上传文本格式的源码文件。');
    const result = new Map(await Promise.all(attachments.map(async file => [file.name, await file.text()])));
    if (pasted.trim()) result.set(language === 'react' || (!language && looksLikeReact(pasted)) ? 'Preview.tsx' : 'index.html', pasted);
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
      let language = framework.value || undefined;
      let sources = await readSources(mode, pasted, language);
      let sourceMetadata = mode === 'source' ? sourceMetadataFromFiles(sources) : {};
      if (mode === 'source' && !sources.length && (kind === 'preview' || !editing)) throw new Error('请粘贴或上传源码。');
      let metadata = {};
      let registry;
      if (mode === 'link') {
        status.textContent = '正在识别名称和预览…';
        try { metadata = await readLinkMetadata(url.value); }
        catch (error) { metadata = { readError: error.message }; }
      } else if (mode === 'registry') {
        status.textContent = '正在读取 Registry 源码和依赖…';
        registry = await readRegistryCommand(registryCommand.value);
        sources = registry.files;
        language = registry.framework;
        url.value = registry.registryUrl;
        if (!name.value.trim() && registry.name) name.value = registryDisplayName(registry.name);
        if (!license.value && registry.license) license.value = registry.license;
        registrySummary.textContent = [
          registry.framework === 'react' ? 'React' : registry.framework?.toUpperCase(),
          registry.license,
          registry.dependencies?.length ? `依赖：${registry.dependencies.join('、')}` : '',
          registry.author ? `作者：${registry.author}` : '',
        ].filter(Boolean).join(' · ');
        registrySummary.hidden = !registrySummary.textContent;
      }
      const detected = inferComponentDetails({ name: name.value, url: url.value, files: sources, framework: language, metadata: { ...sourceMetadata, ...metadata } });
      language = detected.framework;
      if (registry) url.value = registryComponentPage(registry.registryUrl, detected.category) || registry.registryUrl;
      else if (mode === 'source' && !url.value) url.value = sourcePageFromMetadata(sourceMetadata);
      if (!name.value.trim() && detected.name) name.value = detected.name;
      if (!license.value && sourceMetadata.license) license.value = sourceMetadata.license;
      if (!framework.value && language) {
        framework.value = language;
        framework.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (!categoryTouched && detected.category) setDetectedCategory(detected.category);
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
      let { record: saved } = await componentRequest('save', {
        ...(editing ? { id: record.id, componentRevision: record.componentRevision } : {}),
        name: name.value,
        url: url.value,
        category: form.elements.category.value,
        prompt: values.get('prompt'),
        license: license.value,
        ...(sourceMetadata.author ? { sourceAuthor: sourceMetadata.author } : {}),
        ...(sourceMetadata.dependencies?.length ? { dependencies: sourceMetadata.dependencies } : {}),
        ...(registry ? {
          dependencies: registry.dependencies,
          registryUrl: registry.registryUrl,
          installCommand: registry.command,
          registryAuthor: registry.author,
        } : {}),
        ...(sources?.length ? { files: sources, framework: language } : {}),
      });
      if (!editing && mode === 'link' && metadata.media?.length) {
        try { saved = await adoptDetectedPreview(saved, metadata, url.value); }
        catch { saved = { ...saved, previewStatus: { status: 'needs-input', message: '链接已保存，自动预览暂时不可用。' } }; }
      }
      await onSaved(saved, dialog.open && form.isConnected);
    } catch (error) { status.textContent = error.message; }
    finally { busy = false; submit.disabled = preview.disabled = false; }
  }
  preview.onclick = () => perform('preview');
  form.onsubmit = event => { event.preventDefault(); perform('save'); };
}
