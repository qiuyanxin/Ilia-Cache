const escape = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function renderComponentSourcePanel(download, content = '') {
  const link = download ? `<a class="component-source-download" data-source-download href="${escape(download)}" download>下载公开源码 JSON</a>` : '';
  return `<div class="component-source-panel">${link}<div data-source-content>${content}</div></div>`;
}

export function renderComponentSourceContent({ names, selected = 0, state = 'ready' }) {
  if (state === 'ready' && names.length) {
    const buttons = names.map((name, index) =>
      `<button type="button" data-file="${index}" aria-pressed="${index === selected}" class="${index === selected ? 'active' : ''}">${escape(name)}</button>`).join('');
    return `<div class="source-files" role="group" aria-label="源码文件">${buttons}</div><button type="button" id="copy-file">复制当前文件</button><pre class="source-code" role="region" tabindex="0"></pre>`;
  }
  const inventory = names.length
    ? `<ul class="source-files component-source-inventory" aria-label="源码文件">${names.map(name => `<li>${escape(name)}</li>`).join('')}</ul>` : '';
  if (state === 'static') return inventory + '<p class="component-workspace-status">源码文件可下载。</p>';
  if (state === 'loading') return inventory + '<p class="component-workspace-status" role="status">正在加载源码…</p>';
  if (state === 'error') return inventory + '<div class="empty">源码包暂时无法加载。<button type="button" data-retry-source>重试加载源码</button></div>';
  return '<div class="empty">暂无源码</div>';
}

/** Bind controls after the current source package is available. */
export function mountComponentSourceFiles(root, files, { selected, onSelect, copy }) {
  const code = root.querySelector('.source-code');
  const buttons = [...root.querySelectorAll('[data-file]')];
  let current = selected;

  function showFile() {
    const { name, content } = files[current];
    code.setAttribute('aria-label', `${name} 源码`);
    code.textContent = content;
    code.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }

  for (const [index, button] of buttons.entries()) {
    button.onclick = () => {
      if (index === current) return;
      buttons[current].classList.remove('active');
      buttons[current].setAttribute('aria-pressed', 'false');
      current = index;
      button.classList.add('active');
      button.setAttribute('aria-pressed', 'true');
      showFile();
      onSelect(current);
    };
  }
  root.querySelector('#copy-file').onclick = event => copy(files[current].content, event.currentTarget);
  showFile();
}
