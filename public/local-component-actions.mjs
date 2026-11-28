import {
  bindComponentCategoryField, componentRequest, generatedPreview, openComponentForm, renderComponentCategoryField, renderLocalPreviewCandidates,
} from './local-component-editor.mjs';
import { componentWebUrl } from './component-workspace.mjs';
import { collectionMediaEntries } from './catalog.mjs';
import { componentCategory } from './component-taxonomy.mjs';
import { icon } from './icons.mjs';
import { savedCasePreviewUrl } from './reference-media-model.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

function legacyPreviews(record) {
  const media = collectionMediaEntries(record);
  const video = media.find(item => item.type === 'video');
  if (video) return [{ kind: 'video', url: video.url, poster: video.poster }];
  if (media.length) return media.slice(0, 2).map(({ url }) => ({ kind: 'image', url }));
  const url = record.kind === '案例' && savedCasePreviewUrl(record.preview);
  return url ? [{ kind: 'image', url }] : [];
}

function archiveSource(record) {
  return componentWebUrl(record.sourcePageUrl || record.primarySourceUrl || record.sourceUrl || record.url);
}

export function componentArchiveManifest(record, files) {
  return {
    id: record.id,
    name: record.name,
    ...(record.originalName ? { originalName: record.originalName } : {}),
    category: componentCategory(record),
    framework: record.framework || '',
    captureMethod: record.captureMethod || '',
    author: record.primarySourceAuthor || record.registryAuthor || record.sourceShort || '',
    license: record.license || '',
    source: archiveSource(record),
    dependencies: record.dependencies || [],
    sourceFiles: files.map(file => file.name),
    sourceNotice: record.sourceNotice || '',
  };
}

export function componentArchivePrompt(record) {
  if (record.prompt?.trim()) return record.prompt;
  const dependencies = record.dependencies?.length ? `需要的依赖：${record.dependencies.join('、')}。` : '请先从源码 import 中核对依赖。';
  return `请在当前项目中集成「${record.name}」组件。\n\n源码文件已经随 ZIP 提供。${dependencies}\n请适配目标项目现有的技术栈、字体、颜色和圆角，保留组件原有交互与动画。完成后运行项目并实际检查组件。`;
}

export function componentArchiveReadme(record, files) {
  const source = archiveSource(record) || '未提供原网页，请以随附源码为准';
  const dependencies = record.dependencies?.length ? record.dependencies.join('、') : '未单独记录，请从源码 import 中核对';
  const author = record.primarySourceAuthor || record.registryAuthor || record.sourceShort || '未识别';
  const license = record.license || '待确认';
  return `# ${record.name}\n\n- 分类：${componentCategory(record)}\n- 代码格式：${record.framework || '未识别'}\n- 作者：${author}\n- 许可：${license}\n- 原始来源：${source}\n- 依赖：${dependencies}\n\n## 源码文件\n\n${files.map(file => `- ${file.name}`).join('\n')}\n\n## 使用方式\n\n1. 先阅读 PROMPT.md 和 manifest.json。\n2. 将源码文件复制到目标项目，并安装上面列出的依赖。\n3. 按目标项目的技术栈、样式系统和路径别名调整 import。\n4. 运行项目，实际检查布局、交互和动画。\n`;
}

export function createLocalComponentActions(host, acknowledgeResource) {
  const { getState, save, toast, nav, copy } = host;

  function adopt(record) {
    const state = getState();
    state.resources = state.resources.some(item => item.id === record.id)
      ? state.resources.map(item => item.id === record.id ? record : item)
      : [record, ...state.resources];
    acknowledgeResource(record);
    save();
    nav();
    host.refreshComponents();
  }

  async function saveRecord(fields) {
    const { record } = await componentRequest('save', fields);
    return record;
  }

  async function readReferences(id, candidateId) {
    const action = candidateId ? 'selectCandidate' : 'get';
    const { record } = await componentRequest(action, { id, candidateId });
    return record;
  }

  async function loadComponentPackage(id) {
    const response = await fetch('/api/component-package?' + new URLSearchParams({ id }));
    if (!response.ok) throw new Error('源码包读取失败');
    return response.json();
  }

  function sourceUrl(record) {
    return componentWebUrl(record.sourceUrl || record.url);
  }

  function shouldReadSource(record) {
    return !record.sourcePolicy && !record.filePackage && !record.files?.length &&
      !record.sourceNotice && /leibox\.pantoria\.cn\/docs\//.test(record.url);
  }

  async function readSource(dialog, record) {
    const button = dialog.querySelector('#fetch-source');
    if (button) {
      button.disabled = true;
      button.textContent = '正在读取…';
    }
    try {
      const response = await fetch('/api/component-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: record.sourceUrl || record.url, name: record.name }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (data.files.length) {
        const files = new Map((record.files || []).map(file => [file.name, file]));
        for (const file of data.files) files.set(file.name, file);
        record.files = [...files.values()];
      }
      if (data.prompt && (!record.prompt || record.prompt.startsWith('{\n  "source"'))) record.prompt = data.prompt;
      if (data.previewUrl) record.previewUrl = data.previewUrl;
      if (data.resolvedUrl) {
        record.originalUrl ||= record.url;
        record.url = data.resolvedUrl;
        record.mediaFetched = '';
        host.queueMedia(record);
      }
      record.sourceNotice = data.notice;
    } catch (error) {
      record.sourceNotice = error.message;
    }
    save();
    toast(record.sourceNotice);
    host.refreshComponents();
  }

  async function downloadZip(record, files) {
    const manifest = componentArchiveManifest(record, files);
    const response = await fetch('/api/component-zip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: [
        ...files,
        { name: 'PROMPT.md', content: componentArchivePrompt(record) },
        { name: 'README.md', content: componentArchiveReadme(record, files) },
        { name: 'manifest.json', content: JSON.stringify(manifest, null, 2) },
      ] }),
    });
    if (!response.ok) return toast('下载失败，请重试');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(await response.blob());
    link.download = record.name.replace(/[^\w\u4e00-\u9fa5-]/g, '_') + '.zip';
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function openLegacyEditor(dialog, record, onUpdated) {
    dialog.innerHTML = `<form>
      <div class="dialog-heading"><h2 id="component-dialog-title">编辑组件</h2><button type="button" data-close aria-label="关闭">×</button></div>
      <label>名称<input name="name" value="${escape(record.name)}" required></label>
      ${renderComponentCategoryField(record)}
      <label>用途与备注<textarea name="note">${escape(record.note || record.description)}</textarea></label>
      <label>源码链接<input type="url" name="sourceUrl" value="${escape(record.sourceUrl || '')}"></label>
      <div class="dialog-actions"><label class="compact-file-control">${icon('upload')}<span>追加源码文件</span><input name="files" type="file" multiple hidden accept=".html,.css,.js,.mjs,.tsx,.jsx,.ts,.vue,.svelte,.json,.md,.txt"></label>
      <button type="button" id="archive-component">${icon('trash')}移除组件</button><button type="submit" class="primary">保存修改</button></div>
    </form>`;
    bindComponentCategoryField(dialog.querySelector('form'));
    dialog.querySelector('[data-close]').onclick = () => dialog.close();
    dialog.querySelector('#archive-component').onclick = () => {
      record.archived = true;
      save();
      nav();
      host.refreshComponents();
      dialog.close();
      toast('已移除，原始数据仍保留在备份中');
    };
    dialog.querySelector('form').onsubmit = async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const values = new FormData(form);
      const uploads = [...form.elements.files.files];
      if (uploads.some(file => file.size > 3 * 1024 * 1024)) return toast('单个文件请小于 3 MB');
      const files = new Map((record.files || []).map(file => [file.name, file]));
      for (const file of uploads) files.set(file.name, { name: file.name, content: await file.text() });
      if (uploads.length) record.customFiles = true;
      record.name = values.get('name');
      record.componentCategory = values.get('category');
      record.note = values.get('note');
      record.sourceUrl = values.get('sourceUrl');
      record.files = [...files.values()];
      save();
      nav();
      host.refreshComponents();
      onUpdated();
    };
  }

  function mountManage(root, record, { read, edit, getFiles, canDownload }) {
    const canRead = !record.sourcePolicy && !record.componentRevision && sourceUrl(record);
    const actions = root.querySelector('.component-shared-actions');
    actions.insertAdjacentHTML('beforeend', `
        <button id="fetch-source" ${canRead ? '' : 'hidden'}>读取原站源码与提示词</button>
        <button id="component-edit">编辑信息</button>
        <button id="mark-component-use">使用 ${record.usage?.length || 0} 次 ＋</button>
        <button id="download-component">下载 ZIP</button>
        `);
    const editButton = root.querySelector('#component-edit');
    const useButton = root.querySelector('#mark-component-use');
    const download = root.querySelector('#download-component');
    const updateDownload = () => { download.hidden = !canDownload() || !getFiles().length; };
    root.querySelector('#fetch-source').onclick = read;
    editButton.onclick = edit;
    useButton.onclick = () => {
      record.usage ||= [];
      record.usage.push({ id: crypto.randomUUID(), project: '手动记录', created: new Date().toISOString() });
      save();
      host.refreshComponents();
      useButton.textContent = `使用 ${record.usage.length} 次 ＋`;
    };
    download.onclick = () => downloadZip(record, getFiles());
    updateDownload();
    return updateDownload;
  }

  function mountPromptActions(dialog, copyButton, input, record) {
    copyButton.insertAdjacentHTML('beforebegin', '<button id="save-component-prompt" class="primary">保存提示词</button> ');
    copyButton.insertAdjacentHTML('afterend', ' <button id="learn-component-prompt">学习这段提示词</button>');
    dialog.querySelector('#save-component-prompt').onclick = () => {
      record.prompt = input.value;
      save();
      toast('提示词已保存到本机');
    };
    dialog.querySelector('#learn-component-prompt').onclick = () => {
      record.prompt = input.value;
      save();
      dialog.close();
      host.learn(record);
    };
  }

  return {
    legacyPreviews,
    adopt, saveRecord, readReferences, loadComponentPackage, shouldReadSource, readSource,
    openComponentForm, openLegacyEditor, mountManage, mountPromptActions, generatedPreview,
    mountReferenceCandidates: (root, record, source, actions) => renderLocalPreviewCandidates(root, record, source, { ...actions, copy }),
  };
}
