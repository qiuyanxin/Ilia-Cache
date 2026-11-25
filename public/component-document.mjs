export const componentGalleryPage = Object.freeze({
  path: '/components',
  title: 'UI Component Gallery – Browse & Preview | Ilia Cache',
  description: 'Browse a free directory of UI components. Filter by category or source, view available previews, and open the original component page.',
});

export const soundGalleryPage = Object.freeze({
  path: '/sounds',
  title: '音效库 – 界面音效与来源 | Cache',
  description: '搜索 React Bits 的界面与视频音效，打开原始 Sound Lab 试听。',
});

export function componentDetailPath(id) {
  return '/components/' + encodeURIComponent(id);
}

/** Accept a published catalog row or its browser record. */
export function componentDetailPage({ id, originalName, title, name, description }) {
  const label = originalName || title || name || id;
  return {
    path: componentDetailPath(id),
    title: `${label} – UI Component | Ilia Cache`,
    description: description || `Explore ${label} and open the original component source.`,
  };
}
