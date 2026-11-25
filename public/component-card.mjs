import { favoriteButton } from './favorite-button.mjs';
import { icon } from './icons.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

const soundBars = [12, 24, 38, 48, 31, 20, 35, 44, 26, 12].map((height, index) =>
  `<rect x="${index * 7 + 4}" y="${25 - height / 2}" width="3" height="${height}" rx="1.5"/>`).join('');

export function soundThumbnail(label) {
  return `<span class="sound-preview"><svg viewBox="0 0 80 50" aria-hidden="true">${soundBars}</svg><span>${escape(label)}</span></span>`;
}

export function cardImage(url, title, ratio) {
  const size = Number.isFinite(ratio) && ratio > 0 ? ` style="aspect-ratio:${ratio}"` : '';
  return `<img data-preview-media src="${escape(url)}" alt="${escape(title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer"${size}>`;
}

export function cardVideo({ url, poster, title, ratio }) {
  const size = ratio ? ` style="--card-video-ratio:${ratio}"` : '';
  return `<span class="component-video-card" data-card-video="${escape(url)}"${size}>${poster ? cardImage(poster, title, ratio) : cardPlaceholder('interaction')}</span>`;
}

export function cardPlaceholder(kind = 'source') {
  if (kind === 'sound') return soundThumbnail('打开音效来源');
  if (kind === 'interaction') return '<span class="component-code-card">交互预览</span>';
  return '<span class="component-source-preview">在来源页查看预览</span>';
}

function cardPlacement(id, slots) {
  if (!slots || typeof slots !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(slots))) {
    throw new TypeError('组件卡片位置无效。');
  }
  const entries = Object.entries(slots);
  if (!entries.length) throw new TypeError('组件卡片缺少位置。');
  const style = entries.map(([lanes, slot]) => {
    const { column, row } = slot || {};
    if (!['1', '2', '3'].includes(lanes) || !Number.isInteger(column) || column < 1 || column > Number(lanes) ||
        !Number.isSafeInteger(row) || row < 1) throw new TypeError('组件卡片位置无效。');
    return `--card-column-${lanes}:${column};--card-row-${lanes}:${row}`;
  }).join(';');
  return ` data-component-id="${id}" data-lanes="${entries.map(([lanes]) => lanes).join(' ')}" style="${style}"`;
}

/** Render the shared card. The host provides vetted URLs and locally rendered media markup. */
export function renderComponentCard({
  id, title, description, category, source, sourceHref, sourceAuthor, media, href, previewHref, slots, indexed = Boolean(href), collection, workbench = false, interactivePreview,
}) {
  const key = escape(id);
  const name = escape(title);
  const heading = escape(title.replace(/ \| LeiBox$/, ''));
  const noteId = `${href ? 'fallback-' : ''}component-summary-${encodeURIComponent(String(id).toWellFormed())}`;
  const describedBy = description ? ` aria-describedby="${noteId}"` : '';
  const placement = slots === undefined ? '' : cardPlacement(key, slots);
  const thumbnail = indexed ? `<span class="component-thumbnail-stage">${media}</span>` : media;
  const openAttributes = `data-open-component="${key}"`;
  const thumbnailAttributes = `class="component-thumb" aria-label="${previewHref ? '试听' : '预览'} ${name}"`;
  const trigger = interactivePreview
    ? `<div ${thumbnailAttributes} role="group">${thumbnail}</div>`
    : previewHref
    ? `<a ${thumbnailAttributes} href="${escape(previewHref)}" target="_blank" rel="noopener noreferrer"${describedBy}>${thumbnail}</a>`
    : href
    ? `<a ${thumbnailAttributes} href="${escape(href)}"${describedBy}>${thumbnail}</a>`
    : `<button ${thumbnailAttributes} ${openAttributes}>${thumbnail}<span class="preview-chip">点击预览 ↗</span></button>`;
  const titleAttributes = `class="component-title-control"${describedBy}`;
  const titleControl = href ? `<a ${titleAttributes} href="${escape(href)}">${heading}</a>` :
    `<button ${titleAttributes} ${openAttributes}>${heading}</button>`;
  const sourceLabel = escape(source);
  const sourceLink = sourceHref
    ? `<a class="component-source-name" href="${escape(sourceHref)}" target="_blank" rel="noopener noreferrer" title="${escape(sourceAuthor || source)}">${sourceLabel}</a>`
    : `<span class="component-source-name">${sourceLabel}</span>`;
  const cart = collection ? `<button type="button" class="${workbench ? 'card-action card-action--cart' : 'component-cart-add'}" data-cart-add="${key}" aria-label="${collection.inCart ? '移出待选' : '加入待选'} ${name}" aria-pressed="${Boolean(collection.inCart)}">${workbench ? icon(collection.inCart ? 'check' : 'plus') : '＋'}</button>` : '';
  const heart = collection?.favoriteType ? favoriteButton(collection.favoriteType, {id, name: title}, collection.favorite) : '';
  const preview = workbench ? `<div class="favorite-surface">${trigger}${heart}${cart}</div>` : trigger + cart;
  const usage = collection?.usage !== undefined ? `<span>使用 ${escape(collection.usage)} 次</span>` : '';
  return `<article class="component-tile"${indexed ? ' data-indexed' : ''}${placement}>
    ${preview}<h3>${titleControl}</h3><p class="component-summary" id="${noteId}">${escape(description)}</p>
    <div class="component-labels"><span>${escape(category)}</span>${sourceLink}${usage}</div>
  </article>`;
}
