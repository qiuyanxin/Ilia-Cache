import { createHash, randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { isIP } from 'node:net';
import { libraryDirectory } from './library-location.mjs';
import { loadLibrary, updateLibrary, writeLibraryFile } from './library-store.mjs';
import { isComponentRecord } from './public/component-taxonomy.mjs';
import { localImageAttachment, localMediaAttachment } from './public/reference-media-model.mjs';

const seed = new URL('./public/seed.json', import.meta.url);
const componentId = /^[a-z0-9_-]{1,140}$/i;
const fileExtensions = /\.(?:html?|css|[cm]?js|tsx|jsx|ts|vue|svelte|json|md|txt)$/i;
const digest = data => createHash('sha256').update(data).digest('hex');

export class ComponentRecordError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function text(value, limit, label, trim = true) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || value.length > limit) {
    throw new ComponentRecordError(label + '格式不正确或超出长度限制。');
  }
  return trim ? value.trim() : value;
}

function titleFromUrl(value) {
  const url = new URL(value);
  const part = url.pathname.split('/').filter(Boolean).at(-1);
  if (!part) return url.hostname;
  try { return decodeURIComponent(part).replace(/[-_]+/g, ' ').slice(0, 180) || url.hostname; }
  catch { return url.hostname; }
}

function webUrl(value, label, { preserveLink = false } = {}) {
  const input = text(value, 4096, label);
  if (!input) return '';
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new ComponentRecordError(label + '不是有效链接。');
  }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
    throw new ComponentRecordError(label + '需要使用无账号凭据的 HTTP 或 HTTPS 链接。');
  }
  if (!preserveLink) {
    const host = url.hostname.replace(/\.$/, '').toLowerCase();
    if (!host.includes('.') || host.endsWith('.localhost') || host.endsWith('.local') || isIP(host)) {
      throw new ComponentRecordError(label + '需要使用公开域名。');
    }
  }
  return url.href;
}

function sourceFiles(value) {
  if (!Array.isArray(value) || value.length > 40) throw new ComponentRecordError('需要提供源码文件列表，最多 40 个文件。');
  const names = new Set();
  let total = 0;
  return value.map(file => {
    const name = text(file?.name, 160, '文件名');
    if (!fileExtensions.test(name) || /[\\\u0000-\u001f]/.test(name) ||
      name.split('/').some(part => !part || part === '.' || part === '..') || names.has(name) ||
      typeof file.content !== 'string') throw new ComponentRecordError('源码文件名重复或格式无效。');
    names.add(name);
    total += Buffer.byteLength(file.content);
    if (total > 3_000_000) throw new ComponentRecordError('源码文件合计不能超过 3 MB。', 413);
    return { name, content: file.content };
  }).sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

function frameworkOf(value) {
  if (!value) return undefined;
  if (['html', 'react'].includes(value)) return value;
  throw new ComponentRecordError('预览支持 HTML 或 React。');
}

function idOf(value) {
  if (typeof value !== 'string' || !componentId.test(value)) throw new ComponentRecordError('组件编号无效。');
  return value;
}

let seedRows;
function publicSeed() {
  seedRows ||= readFile(seed, 'utf8').then(JSON.parse);
  return seedRows;
}

function recordFor(state, id) {
  const local = state.resources.find(row => row.id === id);
  if (local) return local;
  return publicSeed().then(rows => rows.find(row => row.id === id));
}

export async function getComponentRecord(value) {
  const id = idOf(value);
  const record = await recordFor(await loadLibrary() || { resources: [] }, id);
  if (!isComponentRecord(record)) throw new ComponentRecordError('未找到该组件。', 404);
  return record;
}

async function writeContent(file, content) {
  try {
    await stat(file);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await writeLibraryFile(file, content);
  }
}

async function preparePreview(files, framework, sourceRevision) {
  const { buildComponentPreview } = await import('./preview-builder.mjs');
  const { status, message, preview } = await buildComponentPreview({ files, framework });
  if (status !== 'ready' || typeof preview?.srcdoc !== 'string') return { status, message };
  const name = digest(preview.srcdoc);
  await writeContent(new URL('previews/' + name + '.html', libraryDirectory), preview.srcdoc);
  return { status: 'ready', preview: { kind: 'html', url: '/api/component-previews/' + name, sourceRevision } };
}

export async function previewComponentInput(input) {
  const files = sourceFiles(input.files);
  const framework = frameworkOf(input.framework);
  return preparePreview(files, framework, digest(JSON.stringify({ files, framework })));
}

export async function readComponentPreview(id) {
  if (!/^[a-f0-9]{64}$/.test(id)) throw new ComponentRecordError('未找到该预览。', 404);
  return readFile(new URL('previews/' + id + '.html', libraryDirectory));
}

function replaceRecord(state, record) {
  return {
    ...state,
    resources: state.resources.some(row => row.id === record.id)
      ? state.resources.map(row => row.id === record.id ? record : row)
      : [record, ...state.resources]
  };
}

export async function saveComponentRecord(input) {
  const id = input.id ? idOf(input.id) : null;
  const name = text(input.name, 180, '组件名称');
  const url = webUrl(input.url, '来源链接', { preserveLink: true });
  const category = text(input.category, 80, '组件分类');
  const prompt = input.prompt === undefined ? undefined : text(input.prompt, 120_000, '提示词', false);
  const license = input.license === undefined ? undefined : text(input.license, 4_000, '许可');
  const files = sourceFiles(input.files ?? []);
  const framework = frameworkOf(input.framework);
  if (!id && !url && !files.length) throw new ComponentRecordError('请粘贴代码或组件原页链接。');
  const sourceRevision = files.length ? digest(JSON.stringify({ files, framework })) : null;

  return updateLibrary(async state => {
    const matchesUrl = row => [row.url, row.sourcePageUrl, row.sourceUrl].includes(url);
    let existing = null;
    if (id) existing = await recordFor(state, id);
    else if (url) existing = state.resources.find(row => isComponentRecord(row) && matchesUrl(row)) ||
      (await publicSeed()).find(row => isComponentRecord(row) && matchesUrl(row));
    else if (sourceRevision) existing = state.resources.find(row =>
      isComponentRecord(row) && row.sourceRevision === sourceRevision);
    if (id && !isComponentRecord(existing)) throw new ComponentRecordError('未找到该组件。', 404);
    if (input.componentRevision && input.componentRevision !== existing?.componentRevision) {
      throw new ComponentRecordError('组件已更新，请刷新详情后重试。', 409);
    }
    const matchingSource = !files.length || existing?.sourceRevision === sourceRevision;
    if (!id && existing && matchingSource && (!prompt || prompt === existing.prompt)) {
      return { result: existing };
    }

    const record = {
      category: '组件',
      kind: '案例',
      caseType: '组件',
      tags: [],
      ...(existing || { id: 'local-' + randomUUID(), created: new Date().toISOString() }),
      name: (id ? name : existing?.name) || name || existing?.name ||
        (url ? titleFromUrl(url) : '未命名组件'),
      componentCategory: (id ? category : existing?.componentCategory) || category ||
        existing?.componentCategory || '未分类',
      componentRevision: randomUUID()
    };
    if (url && (id || !existing)) {
      record.url = url;
      if (!existing || !record.sourcePolicy) record.sourcePageUrl = url;
    } else if (!record.url) {
      record.url = '';
    }
    if (prompt !== undefined && (prompt || id || !existing)) {
      if (existing?.prompt && existing.prompt !== prompt) {
        record.promptHistory = [...new Set([...(existing.promptHistory || []), existing.prompt])];
      }
      record.prompt = prompt;
    }
    if (license !== undefined) record.license = license;
    if (files.length) {
      const packageId = 'local-' + sourceRevision;
      const built = await preparePreview(files, framework, sourceRevision);
      await writeContent(new URL('packages/' + packageId + '.json', libraryDirectory),
        JSON.stringify({ id: packageId, framework, files }, null, 2));
      record.captureMethod = 'code';
      record.framework = framework;
      record.sourceRevision = sourceRevision;
      record.filePackage = packageId;
      record.sourceFiles = files.map(({ name }) => ({ name }));
      delete record.files;
      record.previewStatus = { status: built.status, message: built.message };
      if (built.preview) record.preview = built.preview;
      else if (record.preview?.kind === 'html') record.preview = { ...record.preview, stale: true };
    } else if (!record.captureMethod) {
      record.captureMethod = 'link';
      record.previewStatus ||= { status: 'needs-input', message: '待补组件图片或演示视频。' };
    }
    return { next: replaceRecord(state, record), result: record };
  });
}

async function candidateMediaUrl(value, kind, label) {
  const url = text(value, 4096, label);
  if (!localMediaAttachment.test(url)) return webUrl(url, label);
  const actualKind = localImageAttachment.test(url) ? 'image' : 'video';
  if (actualKind !== kind) throw new ComponentRecordError(label + '与附件类型不一致。');
  const file = url.split('/').at(-1);
  try {
    if (!(await stat(new URL('assets/' + file, libraryDirectory))).isFile()) throw Error();
  } catch {
    throw new ComponentRecordError('未找到' + label + '对应的附件。', 404);
  }
  return url;
}

const candidateMetadata = ['poster', 'label', 'provenance', 'width', 'height', 'duration'];

async function normaliseCandidate(input) {
  if (!input || !['image', 'video'].includes(input.kind)) throw new ComponentRecordError('候选素材仅支持图片和视频。');
  const url = await candidateMediaUrl(input.url, input.kind, '素材链接');
  const poster = await candidateMediaUrl(input.poster, 'image', '视频封面');
  if (poster && input.kind !== 'video') throw new ComponentRecordError('只有视频候选可以设置封面。');
  const sourcePageUrl = webUrl(input.sourcePageUrl, '素材来源页面');
  if (!url || !sourcePageUrl) throw new ComponentRecordError('请同时提供素材地址和可核对的来源页面。');
  const candidate = {
    id: 'preview-' + digest(JSON.stringify([input.kind, url, sourcePageUrl])).slice(0, 28),
    kind: input.kind,
    url,
    ...(poster ? { poster } : {}),
    sourcePageUrl,
    label: text(input.label, 240, '素材说明'),
    provenance: text(input.provenance, 240, '素材出处'),
    created: new Date().toISOString()
  };
  for (const field of ['width', 'height', 'duration']) {
    const value = input[field];
    if (value === undefined) continue;
    if (!Number.isFinite(value) || value <= 0 || value > 100_000) {
      throw new ComponentRecordError('素材尺寸或时长不在有效范围。');
    }
    candidate[field] = value;
  }
  return candidate;
}

export async function addPreviewCandidate(value, input) {
  const id = idOf(value);
  const candidate = await normaliseCandidate(input);
  return updateLibrary(async state => {
    const previous = await recordFor(state, id);
    if (!isComponentRecord(previous)) throw new ComponentRecordError('未找到该组件。', 404);
    const candidates = previous.previewCandidates || [];
    const existing = candidates.find(entry => entry.id === candidate.id);
    const changes = candidateMetadata.filter(key => candidate[key] !== undefined && candidate[key] !== '' && existing?.[key] !== candidate[key]);
    if (existing && !changes.length) return { result: previous };
    if (!existing && candidates.length >= 30) throw new ComponentRecordError('该组件已保存 30 个预览候选。', 409);
    const updated = existing ? { ...existing, ...Object.fromEntries(changes.map(key => [key, candidate[key]])) } : candidate;
    const record = {
      ...previous, componentRevision: randomUUID(),
      previewCandidates: existing ? candidates.map(entry => entry.id === candidate.id ? updated : entry) : [...candidates, updated],
      ...(previous.referencePreview?.id === updated.id ? { referencePreview: updated } : {}),
    };
    return { next: replaceRecord(state, record), result: record };
  });
}

export function selectPreviewCandidate(value, candidateValue) {
  const id = idOf(value);
  const candidateId = idOf(candidateValue);
  return updateLibrary(async state => {
    const previous = await recordFor(state, id);
    if (!isComponentRecord(previous)) throw new ComponentRecordError('未找到该组件。', 404);
    const candidate = previous.previewCandidates?.find(entry => entry.id === candidateId);
    if (!candidate) throw new ComponentRecordError('未找到该组件的预览候选。', 404);
    if (previous.referencePreview?.id === candidate.id) return { result: previous };
    const record = { ...previous, componentRevision: randomUUID(), referencePreview: candidate };
    return { next: replaceRecord(state, record), result: record };
  });
}
