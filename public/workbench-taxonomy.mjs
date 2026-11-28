export const WORKBENCH_TABS = Object.freeze([
  ['projects', '项目'],
  ['capture', '采集'],
  ['favorites', '收藏'],
]);

export const WORKBENCH_TYPES = Object.freeze({
  all: '全部',
  website: '网站',
  component: '组件',
  sound: '音效',
  page: '页面',
  font: '字体',
  visual: '视觉参考',
});

export function captureType(record = {}) {
  if (record.aesthetic || ['审美素材', '图片提示词', '视频提示词', '设计风格'].includes(record.category)) return 'visual';
  if (record.category === '组件') return 'component';
  if (record.category === '网页参考') return 'page';
  return 'unclassified';
}

export function referenceType(reference = {}) {
  if (reference.type === 'style' || reference.type === 'aesthetic' || reference.type === 'visual') return 'visual';
  if (['website', 'component', 'sound', 'page', 'font'].includes(reference.type)) return reference.type;
  return 'unclassified';
}

export function filterByWorkbenchType(rows, filter, typeOf) {
  return filter === 'all' ? [...rows] : rows.filter(row => typeOf(row) === filter);
}

export function workbenchTabs(active) {
  return `<nav class="collection-chips workbench-tabs" aria-label="工作台分类">${WORKBENCH_TABS.map(([view, label]) =>
    `<button type="button" data-workbench-view="${view}" class="${view === active ? 'active' : ''}" aria-pressed="${view === active}">${label}</button>`).join('')}</nav>`;
}

export function workbenchTypeTabs(active, rows, typeOf, attribute = 'data-workbench-type') {
  return `<nav class="collection-chips workbench-type-tabs" aria-label="资源类型">${Object.entries(WORKBENCH_TYPES).map(([type, label]) => {
    const count = type === 'all' ? rows.length : rows.filter(row => typeOf(row) === type).length;
    return `<button type="button" ${attribute}="${type}" class="${type === active ? 'active' : ''}" aria-pressed="${type === active}">${label} <small>${count}</small></button>`;
  }).join('')}</nav>`;
}
