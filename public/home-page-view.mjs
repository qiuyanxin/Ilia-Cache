import { icon } from './icons.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

/** Render the library home for a host that provides its own destinations and counts. */
export function renderHomePage(sections, { linkFor, secondary = { id: 'pages', label: '打开页面库' } } = {}) {
  function action(id, content, className = '') {
    const style = className ? ` class="${className}"` : '';
    if (!linkFor) return `<button type="button"${style} data-home-go="${escape(id)}">${content}</button>`;
    const href = linkFor(id);
    return href
      ? `<a${style} href="${escape(href)}">${content}</a>`
      : `<button type="button"${style} disabled>${content}</button>`;
  }

  const index = sections.map(({ id, name, description, count }) => action(id,
    `<span>${escape(count)}</span><b>${escape(name)}</b><small>${escape(description)}</small>`)).join('');
  return `<section class="home-hero">
    <p>组件 · 页面 · 风格 · 素材</p><h1>收集灵感，保存方法，<br>下一次创作直接复用。</h1>
    <div>${action('components', '浏览组件库 ' + icon('right'), 'primary')}${action(secondary.id, escape(secondary.label))}</div>
    <div class="home-orbit" aria-hidden="true"><span>UI</span><span>MOTION</span><span>TASTE</span></div>
  </section><section class="home-index">${index}</section><section class="home-rights">
    <div><h2>每份收藏都保留来源、许可和使用方法。</h2></div>
    <div><p><strong>仅供学习使用。</strong> 第三方设计、代码与素材的权利归原权利人所有，使用须遵守其许可。</p>${action('sources', '查看来源与许可 ' + icon('right'))}</div>
  </section>`;
}
