import {
  componentRequest, generatedPreview, openComponentForm, renderLocalPreviewCandidates,
} from './local-component-editor.mjs';
import { componentWebUrl } from './component-workspace.mjs';
import { collectionMediaEntries } from './catalog.mjs';
import { COMPONENT_CATEGORIES, componentCategory } from './component-taxonomy.mjs';
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
    const manifest = {
      name: record.name, url: record.url, category: componentCategory(record),
      id: record.id, sourceNotice: record.sourceNotice,
    };
    const response = await fetch('/api/component-zip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: [
        ...files,
        { name: 'PROMPT.md', content: record.prompt || '尚无提示词' },
        { name: 'README.md', content: `# ${record.name}\n\n来源：${record.url}\n\n原站许可与依赖请查阅来源页面。\n\n${record.sourceNotice || ''}` },
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
    const selectedCategory = componentCategory(record);
    dialog.innerHTML = `<form>
      <div class="dialog-heading"><h2 id="component-dialog-title">编辑组件</h2><button type="button" data-close aria-label="关闭">×</button></div>
      <label>名称<input name="name" value="${escape(record.name)}" required></label>
      <label>分类<select name="category">${COMPONENT_CATEGORIES.map(category =>
        `<option${selectedCategory === category ? ' selected' : ''}>${escape(category)}</option>`).join('')}</select></label>
      <label>用途与备注<textarea name="note">${escape(record.note || record.description)}</textarea></label>
      <label>源码链接<input type="url" name="sourceUrl" value="${escape(record.sourceUrl || '')}"></label>
      <label class="compact-file-control">${icon('upload')}<span>追加源码文件</span><input name="files" type="file" multiple hidden accept=".html,.css,.js,.mjs,.tsx,.jsx,.ts,.vue,.svelte,.json,.md,.txt"></label>
      <button class="primary">保存修改</button> <button type="button" id="archive-component">移除组件</button>
    </form>`;
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
    root.querySelector("#copy-agent").insertAdjacentHTML('beforebegin', `
        <button id="fetch-source" ${canRead ? '' : 'hidden'}>读取原站源码与提示词</button>
        <button id="component-edit">编辑信息</button>
        <button id="mark-component-use">使用 ${record.usage?.length || 0} 次 ＋</button>
        `);
    root.querySelector("#copy-agent").insertAdjacentHTML('afterend', '<button id="download-component">下载 ZIP</button>');
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
