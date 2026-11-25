import { icon } from './icons.mjs';
import { isLibraryComponent } from './extensions.js';
import { validPublicWebUrl } from './catalog.mjs';
import { spring } from './springs.mjs';
import { esc } from './favorite-button.mjs';

const HERO_PAGES = [
  'page-ms-print-gallery',
  'page-framer-billie',
  'page-21st-coquette-macos-desktop-portfolio-template',
];

export function installHomePage(h) {
  const page = document.createElement('main');
  page.id = 'home-page';
  page.hidden = true;
  document.querySelector('#sources-page').after(page);
  let showing = false;
  let cardSprings = [];

  function renderHero(entries) {
    return `<section class="home-hero">
      <div class="home-hero-copy">
        <h1>把灵感捡回来，<br>把作品做出来。</h1>
        <p>和小鹿卡什一起收藏喜欢的页面、组件和动效，记下来源与用法。下次开工，打开 Cache 接着做。</p>
        <div class="home-hero-links"><button class="primary" data-home-go="pages">浏览页面库 ${icon('right')}</button><button class="outline" data-home-go="components">浏览组件库</button></div>
      </div>
      ${entries.length ? `<div class="home-showcase" aria-label="页面库精选">
        <div class="home-showcase-deck">
          ${entries.map(item => `<div class="home-showcase-card" aria-hidden="true">
            ${item.image ? `<img src="${esc(item.image)}" alt="" decoding="async" referrerpolicy="no-referrer">` : ''}
          </div>`).join('')}
        </div>
        <div class="home-showcase-controls">
          <button type="button" class="home-showcase-open" title="打开当前页面详情">
            <span class="home-showcase-caption" aria-live="polite"></span>${icon('right')}
          </button>
          ${entries.length > 1 ? `<div class="home-showcase-arrows"><button type="button" data-hero-step="-1" aria-label="上一个案例">${icon('left')}</button><button type="button" data-hero-step="1" aria-label="下一个案例">${icon('right')}</button></div>` : ''}
        </div>
      </div>` : ''}
    </section>`;
  }

  function bindHero(entries) {
    if (!entries.length) return;
    const cards = [...page.querySelectorAll('.home-showcase-card')];
    const caption = page.querySelector('.home-showcase-caption');
    const open = page.querySelector('.home-showcase-open');
    let current = 0;
    // Swipe Deck uses this spring to settle the depth of its stacked cards.
    cardSprings = cards.map((card, index) => spring(index, [260, 22], depth => {
      card.style.setProperty('--hero-card-depth', String(depth));
    }));

    function select(index) {
      current = (index + entries.length) % entries.length;
      cards.forEach((card, position) => {
        const depth = (position - current + entries.length) % entries.length;
        card.style.zIndex = String(entries.length - depth);
        cardSprings[position].set(depth);
      });
      caption.textContent = entries[current].name;
      open.setAttribute('aria-label', `打开案例 ${entries[current].name}`);
    }

    open.onclick = () => h.pageLibrary?.open(entries[current].id);
    page.querySelectorAll('[data-hero-step]').forEach(button => {
      button.onclick = () => select(current + Number(button.dataset.heroStep));
    });
    select(0);
  }

  function render() {
    const state = h.getState();
    const components = state.resources.filter(isLibraryComponent).length;
    const pages = state.resources.filter((item) =>
      !item.archived && (item.caseType === '网页参考' || item.pageCategory)
    ).length;
    const styles = h.collections?.styleCount() || 0;
    const aesthetic = (state.inbox || []).filter((item) => !item.archived && item.aesthetic).length;

    const references = HERO_PAGES.map(id => state.resources.find(item => item.id === id && !item.archived))
      .filter(Boolean).map(item => ({
        id: item.id,
        name: item.name,
        image: validPublicWebUrl(item.media?.find(media => media.type === 'image')?.url || ''),
      }));
    cardSprings.forEach(animation => animation.destroy());
    cardSprings = [];
    page.innerHTML = `${renderHero(references)}<section class="home-index"><button data-home-go="components"><span>${components}</span><b>组件库</b><small>交互、动效与源码</small></button><button data-home-go="pages"><span>${pages}</span><b>页面库</b><small>作品集、Dashboard 与 SaaS</small></button><button data-home-go="styles"><span>${styles}</span><b>视觉参考</b><small>风格素材、动效与镜头</small></button><button data-home-go="aesthetic"><span>${aesthetic}</span><b>审美积累</b><small>图片、视频与 Pinterest</small></button></section><section class="home-rights"><div><h2>每份收藏都保留来源、许可和使用方法。</h2></div><div><p><strong>仅供学习使用。</strong> 第三方设计、代码与素材的权利归原权利人所有，使用须遵守其许可。</p><button data-home-go="sources">查看来源与许可 ${icon('right')}</button></div></section>`;
    bindHero(references);
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
    cardSprings.forEach(animation => animation.destroy());
    cardSprings = [];
    page.hidden = true;
  }

  return { show, leave, get showing() { return showing; } };
}
