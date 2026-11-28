import { icon } from './icons.mjs';

const names = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
const recordName = record => record.originalName || record.name || '';
const recordFavorite = record => record.favorite;

export function compareFavoriteNames(a, b, name = recordName, isFavorite = recordFavorite) {
  return Number(Boolean(isFavorite(b))) - Number(Boolean(isFavorite(a))) || names.compare(name(a), name(b));
}

export const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

export function favoriteButton(type, item, selected) {
  const label = `${selected ? '取消收藏' : '收藏'} ${item.name}`;
  return `<button type="button" class="card-action favorite-heart" data-heart-type="${type}" data-heart-id="${esc(item.id)}" data-heart-name="${esc(item.name)}" aria-label="${esc(label)}" aria-pressed="${Boolean(selected)}" title="${esc(label)}">${icon('heart')}</button>`;
}
