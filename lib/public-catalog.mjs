import { motionPreviewForRecord } from '../public/motion-prompt-preview/index.mjs';
import { officialPreviewForRecord, officialSourceForRecord } from '../public/official-component-previews.mjs';
import { componentDetailPath } from '../public/component-document.mjs';

const policies = new Set(['bundled-source', 'official-source-only', 'source-link-only']);
const recordId = /^[a-z0-9][a-z0-9_-]{0,120}$/;
const motionId = /^motion-prompt-(\d{3})$/;
const packageFile = /^[A-Za-z0-9][A-Za-z0-9._-]{0,140}$/;

export const publicTopics = [
  { id: 'dark-mode-toggle', title: 'Dark mode toggle UI', description: 'Dark mode toggle switch examples with live previews and copyable code.', path: '/components/dark-mode-toggle', examples: ['icon-switch', 'labeled-switch'] },
  { id: 'theme-toggle', title: 'Theme toggle', description: 'Theme toggler implementations for a saved preference or system theme.', path: '/components/theme-toggle', examples: ['system-selector', 'fade-switch'] },
];

const string = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : '';

export function publicUrl(value) {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password ||
        !url.hostname.includes('.') || /^[\d.]+$/.test(url.hostname) ||
        /\.(?:localhost|local|internal|test|invalid|example)\.?$/i.test(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

function specificSourcePage(value) {
  const url = publicUrl(value);
  return url && (url.pathname !== '/' || url.search || url.hash) ? url.href : null;
}

function reactBitsAsset(value, suffix) {
  const url = publicUrl(value);
  return url?.origin === 'https://reactbits.dev' &&
    /^\/assets\/video\/[a-z\d_-]+\.[a-z]+$/i.test(url.pathname) &&
    suffix.test(url.pathname) ? url.href : null;
}

function publishedPreview(row, sourcePageUrl, sourcePolicy) {
  if (sourcePolicy === 'bundled-source') {
    const motion = motionPreviewForRecord(row);
    if (motion) return motion;
  }
  // React Bits official media is approved by LICENSE_REVIEW.md.
  if (row.sourceShort === 'React Bits' && new URL(sourcePageUrl).origin === 'https://reactbits.dev') {
    const url = reactBitsAsset(row.previewVideo, /\.(?:webm|mp4)$/i);
    const poster = reactBitsAsset(row.previewPoster, /\.(?:webp|png|jpe?g)$/i);
    if (url) return { kind: 'video', url, ...(poster ? { poster } : {}) };
    if (poster) return { kind: 'image', url: poster };
  }
  return officialPreviewForRecord(row) || { kind: 'external', url: sourcePageUrl };
}

function bundledFiles(row) {
  // Match the tracked, reviewed licence inventory. More collections require an
  // explicit authorization check here and a publication fixture.
  if (row.sourcePolicy !== 'bundled-source' || row.license !== 'MIT' ||
      row.sourceShort !== 'Motion Prompt' || !motionId.test(row.id) ||
      row.filePackage !== row.id || !Array.isArray(row.sourceFiles)) return [];
  const allowed = new Set([row.id + '.txt', 'PROMPT.md', 'LICENSE', 'ORIGIN.json']);
  const names = [...new Set(row.sourceFiles.map(file => file?.name))]
    .filter(name => packageFile.test(name) && allowed.has(name));
  return [row.id + '.txt', 'LICENSE', 'ORIGIN.json'].every(name => names.includes(name)) ? names : [];
}

/** Select only the files advertised by the published catalog. */
export function projectPublicComponentBundle(record, bundle) {
  const invalid = () => new Error('公开源码包缺少文件或来源许可声明：' + record.id);
  if (record.sourcePolicy !== 'bundled-source' || !record.files?.length ||
      bundle?.id !== record.id || !Array.isArray(bundle.files)) throw invalid();
  const files = new Map();
  for (const file of bundle.files) {
    if (typeof file?.name !== 'string' || typeof file.content !== 'string' || files.has(file.name)) throw invalid();
    files.set(file.name, file.content);
  }
  if (record.files.some(name => !files.has(name)) ||
      ['LICENSE', 'ORIGIN.json'].some(name => !record.files.includes(name) || !files.get(name)?.trim())) throw invalid();
  return { id: record.id, files: record.files.map(name => ({ name, content: files.get(name) })) };
}

/**
 * Input is the tracked public seed. Private library records are never inputs
 * to this projection, including for a component with the same identifier.
 */
export function buildPublicCatalog(seed) {
  if (!Array.isArray(seed)) throw new TypeError('Expected the tracked public seed array.');
  const components = new Map();
  for (const row of seed) {
    if (!row || row.archived || typeof row.id !== 'string' || !recordId.test(row.id) ||
        !policies.has(row.sourcePolicy) || components.has(row.id)) continue;
    const sourcePageUrl = specificSourcePage(officialSourceForRecord(row) || row.sourcePageUrl);
    const title = string(row.name, 180);
    if (!title || !sourcePageUrl) continue;
    const category = string(row.componentCategory, 100) || '未分类';
    const sourceName = string(row.sourceShort, 150);
    const description = string(row.description, 600);
    const files = bundledFiles(row);
    // Downgrade inconsistent records rather than advertising an unavailable
    // source distribution permission.
    const sourcePolicy = row.sourcePolicy === 'bundled-source' && !files.length
      ? 'source-link-only' : row.sourcePolicy;
    components.set(row.id, {
      id: row.id,
      title,
      originalName: string(row.originalName, 180),
      description: category === '音效' && sourceName === 'React Bits'
        ? description.replace(/；点击卡片试听。$/, '；可在原站试听。') : description,
      category,
      tags: Array.isArray(row.tags) ? row.tags.map(tag => string(tag, 80)).filter(Boolean).slice(0, 30) : [],
      sourceAuthor: string(row.primarySourceAuthor, 150),
      sourceName,
      collectionSource: string(row.collectionSource?.name, 150),
      sourcePageUrl,
      sourcePageKind: row.sourcePageKind === 'primary' ? 'primary' : 'collection',
      sourcePolicy,
      license: string(row.license, 300) || 'unknown',
      preview: publishedPreview(row, sourcePageUrl, sourcePolicy),
      prompt: string(row.prompt, 24000),
      path: componentDetailPath(row.id),
      files,
    });
  }
  return { version: 1, components: [...components.values()], topics: publicTopics };
}
