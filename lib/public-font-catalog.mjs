import { publicUrl } from './public-catalog.mjs';

/** Publish font metadata and approved provider CSS links from the tracked catalog. */
export function buildPublicFontCatalog(catalog) {
  if (!Array.isArray(catalog)) throw new TypeError('公开字体目录必须是数组。');
  const fonts = new Map();
  for (const row of catalog) {
    if (typeof row?.id !== 'string' || !row.id || fonts.has(row.id) || typeof row.name !== 'string' || !row.name) continue;
    const source = publicUrl(row.sourceUrl);
    if (!source) continue;
    const css = publicUrl(row.previewUrl);
    const preview = css?.origin === 'https://fonts.googleapis.com' && css.pathname === '/css2' && css.searchParams.has('family');
    fonts.set(row.id, {
      id: row.id,
      name: row.name,
      sourceUrl: source.href,
      source: typeof row.source === 'string' ? row.source : '',
      category: typeof row.category === 'string' ? row.category : '',
      chinese: row.chinese === true,
      license: typeof row.license === 'string' ? row.license : '',
      commercial: typeof row.commercial === 'string' ? row.commercial : '',
      ...(preview && typeof row.cssFamily === 'string' ? { previewUrl: css.href, cssFamily: row.cssFamily } : {}),
    });
  }
  return [...fonts.values()];
}
