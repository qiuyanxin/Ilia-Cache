import { officialPreviewForRecord } from './official-component-previews.mjs';
import { cardImage, cardVideo } from './component-card.mjs';
import { renderDetailMediaStage } from './component-detail-preview.mjs';
import { renderComponentReferences } from './component-detail-chrome.mjs';
import { localImageAttachment, localMediaAttachment, referenceAspectRatio, savedCasePreviewUrl } from './reference-media-model.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function componentWebUrl(value) {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return '';
    return url.href;
  } catch { return ''; }
}

export function referenceMedia(reference, title, { card = false, autoplay = false, loop = false, savedImage = false } = {}) {
  const raw = reference?.url || '';
  const url = savedImage && reference?.kind === 'image' && savedCasePreviewUrl(raw) ||
    (localMediaAttachment.test(raw) ? raw : componentWebUrl(raw));
  if (!url) return '';
  const ratio = referenceAspectRatio(reference);
  if (reference.kind === 'image') {
    if (card) return cardImage(url, title, ratio);
    const size = ratio ? ` style="aspect-ratio:${ratio}"` : '';
    return `<img data-preview-media loading="lazy" src="${escape(url)}" referrerpolicy="no-referrer" alt="${escape(title)}"${size}>`;
  }
  if (reference.kind === 'video') {
    const poster = localImageAttachment.test(reference.poster) ? reference.poster : componentWebUrl(reference.poster);
    if (card) return cardVideo({ url, poster, title, ratio });
    const controls = `controls${loop ? ' muted loop data-autoplay-preview' : ''}${autoplay ? ' autoplay' : ''}`;
    return `<video data-preview-media class="component-full-video" src="${escape(url)}"${poster ? ` poster="${escape(poster)}"` : ''} preload="metadata" ${controls} playsinline aria-label="${escape(title)}"></video>`;
  }
  return '';
}

export function renderPreviewReferences(root, record, sourceUrl, preview = record.referencePreview) {
  const source = componentWebUrl(sourceUrl);
  const official = record.previewVideo ? { kind: 'video', url: record.previewVideo, poster: record.previewPoster } : officialPreviewForRecord(record);
  const featured = preview || official;
  const featuredMedia = referenceMedia(featured, record.name);
  root.innerHTML = renderComponentReferences({
    source: source ? { href: source, label: (record.sourcePageKind === 'collection' ? '打开收录页' : '打开组件来源') + ' ↗' } : undefined,
    author: record.primarySourceAuthor, license: record.license,
    media: featuredMedia ? renderDetailMediaStage(featuredMedia, featured) : '',
    citation: componentWebUrl(featured?.sourcePageUrl),
  });
}
