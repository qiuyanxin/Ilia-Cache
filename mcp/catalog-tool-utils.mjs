export const kinds = [
  'component', 'website', 'page', 'resource', 'style', 'font', 'lesson',
  'capture', 'project', 'site_summary', 'pinterest_board', 'library_settings', 'asset',
];

export function localOrigin(value) {
  const url = new URL(value || 'http://127.0.0.1:4317');
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname) ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('ILIACACHE_PREVIEW_BASE_URL 必须是本机 Ilia-Cache 站点的 HTTP origin。');
  }
  return url.origin;
}

export function textPage(text, offset, limit) {
  let end = Math.min(offset + limit, text.length);
  // Avoid splitting a UTF-16 surrogate pair between responses.
  if (end > offset && /[\uD800-\uDBFF]/u.test(text[end - 1]) && end < text.length) end += 1;
  return { text: text.slice(offset, end), total: text.length, nextOffset: end < text.length ? end : null };
}

