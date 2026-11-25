import { styleReferenceGroup, styleReferenceSubcategory } from './component-categories.mjs';
import { esc } from './favorite-button.mjs';

export const VISUAL_REFERENCE_TABS = ['设计风格', '动画与镜头', '摄影与画风'];

export function referencesByStyle(styles, references) {
  const normalize = value => String(value || '').trim().toLowerCase();
  const stylesByName = new Map();
  for (const style of styles) {
    const name = normalize(style.english);
    if (name && !stylesByName.has(name)) stylesByName.set(name, style.id);
  }
  return new Map(references.flatMap(item => {
    const style = stylesByName.get(normalize(item.originalName));
    return style && styleReferenceGroup(item) === '摄影与画风' ? [[item.id, style]] : [];
  }));
}

export function renderVisualReferenceTabs(active, styleCount, references, linkFor) {
  return `<nav class="collection-chips style-library-tabs" aria-label="视觉参考分类">${VISUAL_REFERENCE_TABS.map(label => {
    const count = label === '设计风格' ? styleCount : references.filter(item => styleReferenceGroup(item) === label).length;
    const className = label === active ? 'active' : '';
    const content = label + ' <small>' + count + '</small>';
    return linkFor
      ? `<a href="${esc(linkFor(label))}" class="${className}"${className ? ' aria-current="page"' : ''}>${content}</a>`
      : `<button type="button" data-style-tab="${label}" class="${className}" aria-pressed="${label === active}">${content}</button>`;
  }).join('')}</nav>`;
}

export function describeVisualReferences(references) {
  return references.map(item => ({
    ...item,
    referenceGroup: styleReferenceGroup(item),
    referenceCategory: styleReferenceSubcategory(item),
  })).filter(item => item.referenceGroup);
}
