import { COMPONENT_CATEGORIES } from './component-search.mjs';

const detailTabs = { preview: '预览', references: '参考素材', prompt: '提示词', source: '源码' };

export function componentDetailTabs({ references, source }) {
  return ['预览', ...(references ? ['参考素材'] : []), '提示词', ...(source ? ['源码'] : [])];
}

export function readComponentDetailTab(parameters = '') {
  const key = new URLSearchParams(parameters).get('tab');
  return Object.hasOwn(detailTabs, key) ? detailTabs[key] : detailTabs.preview;
}

export function componentDetailTabQuery(tab, parameters = '') {
  const query = new URLSearchParams(parameters);
  const key = Object.keys(detailTabs).find(key => detailTabs[key] === tab);
  if (key && key !== 'preview') query.set('tab', key);
  else query.delete('tab');
  return query.size ? '?' + query : '';
}

/** Directory state carried by a website query or a local component route's fragment. */
export function readComponentFilters(parameters = '', { sources } = {}) {
  const params = new URLSearchParams(parameters);
  const category = params.get('category') || '';
  const source = params.get('source') || '';
  return {
    query: (params.get('q') || '').replace(/\0/g, ''),
    category: COMPONENT_CATEGORIES.includes(category) ? category : '',
    source: !sources || sources.has(source) ? source : '',
  };
}

export function componentFilterQuery({ query, category, source }, parameters = '') {
  const params = new URLSearchParams(parameters);
  for (const [key, value] of [['q', query], ['category', category], ['source', source]]) {
    if (typeof value === 'string' && value.trim()) params.set(key, value);
    else params.delete(key);
  }
  const encoded = params.toString();
  return encoded ? '?' + encoded : '';
}
