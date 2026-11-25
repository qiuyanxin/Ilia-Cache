import { officialSourceForRecord } from './official-component-previews.mjs';

export { COMPONENT_CATEGORIES } from './component-search.mjs';

const sourceNames = new Map([
  ['reactbits.dev', 'React Bits'],
  ['leibox.pantoria.cn', 'LeiBox'],
  ['designbookmark.com', 'DesignBookmark'],
  ['transitions.dev', 'Transitions'],
  ['showheyohtaki.github.io', 'Motion Prompt'],
  ['kokonutui.com', 'Kokonut UI'],
  ['smoothui.dev', 'SmoothUI'],
]);

export function isComponentRecord(record, { includeArchived = false } = {}) {
  return Boolean(record && (includeArchived || !record.archived) && (
    record.caseType === '组件' || record.componentCategory || record.builtin ||
    (record.kind === '案例' && record.category === '组件')
  ));
}

export function componentCategory(record) {
  if (record.componentCategory) return record.componentCategory;
  const url = record.url || '';
  if (/compare|carousel|gallery|slider/i.test(url)) return '图集与轮播';
  if (/text|split|type/i.test(url)) return '文字';
  if (/button|input|cord/i.test(url)) return '按钮与输入';
  if (/background|shader/i.test(url)) return '背景与物体';
  return '卡片';
}

export function sourceName(record) {
  if (record.sourceShort) return record.sourceShort;
  try {
    const host = new URL(record.url).hostname.replace(/^www\./, '');
    return sourceNames.get(host) || host;
  } catch {
    return '本机';
  }
}

export function sourcePage(record) {
  return officialSourceForRecord(record) || record.sourcePageUrl || record.primarySourceUrl || record.sourceUrl || record.url;
}

export function allowsComponentSource(record, { allowUnclassified = false } = {}) {
  return Boolean(record && (record.sourcePolicy === 'bundled-source' || (allowUnclassified && !record.sourcePolicy)));
}

export function canDistributeSource(record) {
  if (!allowsComponentSource(record, { allowUnclassified: true })) return false;
  return record.sourcePolicy === 'bundled-source' || Boolean(record.customFiles || record.files?.length || record.filePackage);
}
