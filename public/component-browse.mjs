import { COMPONENT_BROWSE_GROUPS, componentBrowseCategory, styleReferenceGroup } from './component-categories.mjs';
import { compareComponentSources, compareComponentTitles, createSearchRanker, componentSearchFields, prepareSearchQuery } from './component-search.mjs';
import { compareFavoriteNames } from './favorite-button.mjs';

const readPublishedSource = record => record.sourceShort || '';

export function appearsInComponentBrowse(record) {
  return record.componentCategory !== '音效' && !record.soundRecipe && !styleReferenceGroup(record);
}

export function componentLoadRank(record) {
  if (/^motion-prompt-\d{3}$/.test(record.id)) return 1;
  if (record.soundRecipe || record.localPoster || record.referencePreview?.kind === 'image') return 0;
  if (record.builtin || record.builtinNative || String(record.thumbnailFrame || '').startsWith('/')) return 1;
  if (record.previewPoster) return 2;
  if (record.previewVideo || record.thumbnailFrame) return 3;
  return 4;
}

export function describeComponentBrowse(records, readSource = readPublishedSource) {
  const sourceCounts = new Map();
  const subcategoryCounts = Object.create(null);
  const categoryCounts = Object.assign(Object.create(null), { '': records.length });
  for (const record of records) {
    const category = componentBrowseCategory(record);
    subcategoryCounts[category] = (subcategoryCounts[category] || 0) + 1;
    const stored = record.componentCategory;
    if (stored) categoryCounts[stored] = (categoryCounts[stored] || 0) + 1;
    const source = readSource(record);
    if (source) sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
  }
  for (const [group, categories] of Object.entries(COMPONENT_BROWSE_GROUPS)) {
    categoryCounts[group] = categories.reduce((total, category) => total + (subcategoryCounts[category] || 0), 0);
  }
  return {
    categoryCounts, subcategoryCounts,
    sources: [...sourceCounts.keys()].sort(compareComponentSources),
  };
}

export function browseComponentRecords(records, { query = '', category = '', subcategory = '', source = '' } = {},
  { readSource = readPublishedSource, fuzzyFallback = false, favoritesFirst = false } = {}) {
  const group = Object.hasOwn(COMPONENT_BROWSE_GROUPS, category) ? COMPONENT_BROWSE_GROUPS[category] : undefined;
  const accepted = subcategory && group?.includes(subcategory) ? [subcategory] : group;
  const keyword = query.toLowerCase();
  const available = records.filter(record => {
    const facet = componentBrowseCategory(record);
    return (!accepted ? !category || record.componentCategory === category : accepted.includes(facet)) &&
      (!source || source === readSource(record));
  });
  const matches = available.filter(record => !keyword || [
    record.name, record.originalName, record.note, record.prompt, record.url,
    record.primarySourceAuthor, readSource(record), componentBrowseCategory(record), category, ...(record.tags || []),
  ].join(' ').toLowerCase().includes(keyword));
  const search = fuzzyFallback && keyword && !matches.length ? prepareSearchQuery(query) : undefined;
  const results = search?.terms.length ? available.filter(record => createSearchRanker(
    componentSearchFields(record, { source: readSource(record), category: componentBrowseCategory(record) }),
    () => record.prompt,
  )(search) >= 0) : matches;
  if (favoritesFirst) return results.sort(compareFavoriteNames);
  return results.sort((a, b) => (!keyword ? compareComponentSources(readSource(a), readSource(b)) :
    Number(readSource(a) === 'Motion Prompt') - Number(readSource(b) === 'Motion Prompt')) ||
    (!category ? (b.usage?.length || 0) - (a.usage?.length || 0) : 0) ||
    componentLoadRank(a) - componentLoadRank(b) || compareComponentTitles(a, b));
}
