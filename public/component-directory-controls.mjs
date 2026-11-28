import { COMPONENT_BROWSE_GROUPS } from './component-categories.mjs';
import { compareComponentSources } from './component-search.mjs';

export const allComponentCategories = '浏览全部';
export const allComponentSources = '全部来源';

const escape = value => String(value ?? '').replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

/** Reveal a choice without shifting the page vertically. */
export function revealComponentFilterChoice(group, choice) {
  if (!choice || group.scrollWidth <= group.clientWidth) return;
  const left = group.getBoundingClientRect().left + group.clientLeft;
  const right = left + group.clientWidth;
  const bounds = choice.getBoundingClientRect();
  const shift = bounds.left < left ? bounds.left - left : Math.max(0, bounds.right - right);
  if (Math.abs(shift) >= 1) group.scrollBy({ left: shift, behavior: 'instant' });
}

/** Use live buttons or native GET inputs with the same option labels and sizes. */
export function renderComponentFilterChoices(group, values, { selected = '', form, counts, allLabel } = {}) {
  const category = group !== 'source';
  const all = allLabel || (category ? allComponentCategories : allComponentSources);
  const attribute = group === 'subcategory' ? 'data-subcategory' : category ? 'data-cc' : 'data-source-filter';
  const ordered = category ? values : [...values].sort(compareComponentSources);
  return ['', ...ordered].map(value => {
    const label = escape(value || all);
    const active = selected === value;
    const count = category ? `<small>${escape(counts ? counts[value] ?? 0 : '')}</small>` : '';
    if (form) {
      return `<label class="component-filter-choice">
        <input type="radio" name="${group}" value="${escape(value)}" form="${escape(form)}" aria-label="${label}"${active ? ' checked' : ''}>${label}${count}</label>`;
    }
    const key = allLabel ? escape(value) : label;
    return `<button type="button" ${attribute}="${key}"${allLabel && active ? ' class="active"' : ''} aria-pressed="${active}">${label}${count}</button>`;
  }).join('');
}

export function renderGroupedComponentFilters(facets, { category = '', subcategory = '' } = {}, { form } = {}) {
  const groups = Object.keys(COMPONENT_BROWSE_GROUPS);
  const selectedGroup = groups.includes(category) ? COMPONENT_BROWSE_GROUPS[category] : [];
  if (category && !selectedGroup.length) groups.push(category);
  const primary = renderComponentFilterChoices('category', groups, {
    selected: category, form, counts: facets.categoryCounts, allLabel: '全部',
  });
  const available = selectedGroup.filter(name => facets.subcategoryCounts[name] > 0);
  const children = selectedGroup.length > 1 && available.length ? renderComponentFilterChoices('subcategory', available, {
    selected: subcategory, form, counts: { ...facets.subcategoryCounts, '': facets.categoryCounts[category] || 0 },
    allLabel: '全部' + category,
  }) : '';
  return `<nav class="component-categories component-main-categories" aria-label="组件分类">${primary}</nav>${
    children ? `<nav class="component-categories component-subcategories" aria-label="${escape(category)}细分">${children}</nav>` : ''
  }`;
}

export function describeComponentDirectoryResults(count, { query, category, source, entity = '组件' } = {}) {
  const filtered = Boolean(query?.trim() || category || source);
  if (!count) {
    return { kind: 'empty', message: filtered ? `找不到符合条件的${entity}。` : `这里还没有${entity}。`, canClear: filtered };
  }
  return filtered ? { kind: 'filtered', message: `找到 ${count} 个${entity}。`, canClear: true } :
    { kind: 'all', message: '', canClear: false };
}

/** The website can clear filters without JavaScript through a real gallery link. */
export function renderComponentDirectoryStatus({ kind, message, canClear }, { clearHref } = {}) {
  const resetAttributes = `class="component-directory-reset" data-clear-directory${canClear ? '' : ' hidden'}`;
  const reset = clearHref
    ? `<a ${resetAttributes} href="${escape(clearHref)}">清除筛选</a>`
    : `<button type="button" ${resetAttributes}>清除筛选</button>`;
  return `<div class="component-directory-status${kind === 'empty' ? ' empty' : ''}" data-directory-status="${kind}"${kind === 'all' ? ' hidden' : ''}>
    <p role="status">${escape(message)}</p>${reset}</div>`;
}
