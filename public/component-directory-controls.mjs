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
export function renderComponentFilterChoices(group, values, { selected = '', form, counts } = {}) {
  const category = group === 'category';
  const all = category ? allComponentCategories : allComponentSources;
  const attribute = category ? 'data-cc' : 'data-source-filter';
  return ['', ...values].map(value => {
    const label = escape(value || all);
    const active = selected === value;
    const count = category ? `<small>${escape(counts ? counts[value] ?? 0 : '')}</small>` : '';
    if (form) {
      return `<label class="component-filter-choice">
        <input type="radio" name="${group}" value="${escape(value)}" form="${escape(form)}" aria-label="${label}"${active ? ' checked' : ''}>${label}${count}</label>`;
    }
    return `<button type="button" ${attribute}="${label}" aria-pressed="${active}">${label}${count}</button>`;
  }).join('');
}

export function describeComponentDirectoryResults(count, { query, category, source } = {}) {
  const filtered = Boolean(query?.trim() || category || source);
  if (!count) {
    return { kind: 'empty', message: filtered ? '找不到符合条件的组件。' : '这里还没有组件。', canClear: filtered };
  }
  return filtered ? { kind: 'filtered', message: `找到 ${count} 个组件。`, canClear: true } :
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
