import { icon } from './icons.mjs';

export const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

export function favoriteButton(type, item, selected) {
  const label = `${selected ? '取消收藏' : '收藏'} ${item.name}`;
  return `<button type="button" class="card-action favorite-heart" data-heart-type="${type}" data-heart-id="${esc(item.id)}" data-heart-name="${esc(item.name)}" aria-label="${esc(label)}" aria-pressed="${Boolean(selected)}" title="${esc(label)}">${icon('heart')}</button>`;
}
