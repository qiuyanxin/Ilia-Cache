import { officialSourceForRecord } from './official-component-previews.mjs';

import { COMPONENT_CATEGORIES, componentCategory as browseOriginalCategory, styleReferenceGroup } from './component-categories.mjs';

export { COMPONENT_CATEGORIES };

const sourceNames = new Map([
  ['reactbits.dev', 'React Bits'],
  ['leibox.pantoria.cn', 'LeiBox'],
  ['designbookmark.com', 'DesignBookmark'],
  ['transitions.dev', 'Transitions'],
  ['showheyohtaki.github.io', 'Motion Prompt'],
  ['kokonutui.com', 'Kokonut UI'],
  ['smoothui.dev', 'SmoothUI'],
]);

const originalMotionId = /^ilia-motion-[a-z]+$/;
const originalMotionTag = /^Ilia\s*原创实现$/i;
const motionCategories = new Map([
  ['enter', '滚动与页面切换'],
  ['text', '文字特效'],
  ['hover', '悬停与按压'],
  ['scroll', '滚动与页面切换'],
  ['feedback', '加载与反馈'],
  ['loop', '打字与滚动'],
  ['layout', '内容卡片'],
]);
const legacyMotionCategories = new Map([
  ['页面与转场', 'enter'],
  ['文字', 'text'],
  ['按钮与输入', 'hover'],
  ['提示与状态', 'feedback'],
  ['卡片', 'layout'],
]);

export function hasOriginalMotionBundle(record) {
  return originalMotionId.test(record?.id) && record.primarySourceAuthor === 'Ilia' &&
    record.sourcePolicy === 'bundled-source' && record.filePackage === record.id;
}

export function normalizeOriginalMotionRecord(record) {
  if (!originalMotionId.test(record?.id) || record.primarySourceKind !== 'original') return record;
  const legacyGroup = legacyMotionCategories.get(record.componentCategory);
  const group = record.id === 'ilia-motion-marquee' ? 'loop'
    : record.motionPattern?.category;
  const componentCategory = !record.componentCategory || legacyGroup
    ? motionCategories.get(group) || motionCategories.get(legacyGroup) || record.componentCategory
    : record.componentCategory;
  const tags = Array.isArray(record.tags)
    ? record.tags.filter(tag => typeof tag !== 'string' || !originalMotionTag.test(tag.trim())) : undefined;
  if (record.sourceShort === '原创' && record.componentCategory === componentCategory &&
      (!tags || tags.length === record.tags.length)) return record;
  return { ...record, ...(componentCategory && { componentCategory }), sourceShort: '原创', ...(tags && { tags }) };
}

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

export function isSoundEffect(record) {
  return isComponentRecord(record) && (Boolean(record.soundRecipe) || browseOriginalCategory(record) === '音效');
}

export function isLibraryComponent(record) {
  return isComponentRecord(record) && !isSoundEffect(record) && !styleReferenceGroup(record);
}
