import { renderHomePage } from './home-page-view.mjs';

export function installHomePage(h) {
  const page = document.createElement('main');
  page.id = 'home-page';
  page.hidden = true;
  document.querySelector('#sources-page').after(page);
  let showing = false;

  function render() {
    const state = h.getState();
    const components = state.resources.filter((item) =>
      !item.archived && (item.caseType === '组件' || item.componentCategory || item.builtin)
    ).length;
    const pages = state.resources.filter((item) =>
      !item.archived && (item.caseType === '网页参考' || item.pageCategory)
    ).length;
    const styles = h.collections?.allStyles().length || 0;
    const aesthetic = (state.inbox || []).filter((item) => !item.archived && item.aesthetic).length;

    page.innerHTML = renderHomePage([
      { id: 'components', name: '组件库', description: '交互、动效与源码', count: components },
      { id: 'pages', name: '页面库', description: '作品集、Dashboard 与 SaaS', count: pages },
      { id: 'styles', name: '设计风格', description: '素材与可复用提示词', count: styles },
      { id: 'aesthetic', name: '审美积累', description: '图片、视频与 Pinterest', count: aesthetic },
    ]);
    page.querySelectorAll('[data-home-go]').forEach((button) => {
      button.onclick = () => h.switchView(button.dataset.homeGo);
    });
  }

  function show() {
    showing = true;
    for (const id of ['library', 'learning', 'component-library', 'collection-pages', 'projects-page', 'page-library', 'font-library', 'sources-page']) {
      document.getElementById(id)?.setAttribute('hidden', '');
    }
    page.hidden = false;
    document.querySelector('#breadcrumb').textContent = '首页';
    render();
  }

  function leave() {
    showing = false;
    page.hidden = true;
  }

  return { show, leave, get showing() { return showing; } };
}
