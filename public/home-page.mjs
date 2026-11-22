import { icon } from './icons.mjs';

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

    page.innerHTML = `<section class="home-hero"><p>组件 · 页面 · 风格 · 素材</p><h1>收集灵感，保存方法，<br>下一次创作直接复用。</h1><div><button class="primary" data-home-go="components">浏览组件库 ${icon('right')}</button><button data-home-go="pages">打开页面库</button></div><div class="home-orbit" aria-hidden="true"><span>UI</span><span>MOTION</span><span>TASTE</span></div></section><section class="home-index"><button data-home-go="components"><span>${components}</span><b>组件库</b><small>交互、动效与源码</small></button><button data-home-go="pages"><span>${pages}</span><b>页面库</b><small>作品集、Dashboard 与 SaaS</small></button><button data-home-go="styles"><span>${styles}</span><b>设计风格</b><small>素材与可复用提示词</small></button><button data-home-go="aesthetic"><span>${aesthetic}</span><b>审美积累</b><small>图片、视频与 Pinterest</small></button></section><section class="home-rights"><div><h2>每份收藏都保留来源、许可和使用方法。</h2></div><div><p><strong>仅供学习使用。</strong> 第三方设计、代码与素材的权利归原权利人所有，使用须遵守其许可。</p><button data-home-go="sources">查看来源与许可 ${icon('right')}</button></div></section>`;
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
