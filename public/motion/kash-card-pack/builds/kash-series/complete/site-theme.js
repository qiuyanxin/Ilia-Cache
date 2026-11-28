const key = 'ilia-design-theme';

function syncTheme() {
  let theme = 'dark';
  try {
    if (localStorage.getItem(key) === 'light') theme = 'light';
  } catch {
    // In the offline file, keep the same default as the workspace.
  }
  document.documentElement.dataset.theme = theme;
}

syncTheme();
window.addEventListener('storage', event => {
  if (event.key === key || event.key === null) syncTheme();
});
