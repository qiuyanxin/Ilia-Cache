const themeKey = 'ilia-design-theme';
const isTheme = value => value === 'light' || value === 'dark';
const previewFrames = '#theme-controls iframe, #component-dialog iframe, .component-thumb iframe';

export function setWorkspaceTheme(theme) {
  if (!isTheme(theme)) return;
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(themeKey, theme); } catch {}
}

/** Mount the pull cord and synchronize embedded previews when they load or the theme changes. */
export function installWorkspaceTheme(pullCordUrl) {
  const root = document.documentElement;
  const controls = document.getElementById('theme-controls');
  const windowElement = document.createElement('div');
  windowElement.className = 'cord-window';
  const cord = document.createElement('iframe');
  cord.title = '拉动灯绳切换黑白界面';
  cord.setAttribute('sandbox', 'allow-scripts');
  const label = document.createElement('span');
  label.textContent = '拉绳换肤';
  windowElement.append(cord);
  controls.className = 'pull-cord-control';
  controls.replaceChildren(windowElement, label);

  function notify(frame) {
    frame.contentWindow?.postMessage({ type: 'motion:theme', theme: root.dataset.theme }, '*');
  }
  document.addEventListener('load', event => {
    if (event.target instanceof HTMLIFrameElement && event.target.matches(previewFrames)) notify(event.target);
  }, true);
  new MutationObserver(() => document.querySelectorAll(previewFrames).forEach(notify))
    .observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  addEventListener('message', event => {
    if (event.source === cord.contentWindow && event.data?.type === 'ilia:theme' && typeof event.data.light === 'boolean') {
      setWorkspaceTheme(event.data.light ? 'light' : 'dark');
    }
  });
  function release(event) {
    cord.contentWindow?.postMessage({ type: 'ilia:release-cord', pointerId: event.pointerId }, '*');
  }
  document.addEventListener('pointerup', release, true);
  document.addEventListener('pointercancel', release, true);
  cord.src = pullCordUrl;
}
