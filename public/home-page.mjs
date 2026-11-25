import { renderHomePage } from './home-page-view.mjs';

export function installHomePage(h) {
  const page = document.createElement('main');
  page.id = 'home-page';
  page.hidden = true;
  document.querySelector('#sources-page').after(page);
  let showing = false;

  function render() {
    page.innerHTML = renderHomePage([]);
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
