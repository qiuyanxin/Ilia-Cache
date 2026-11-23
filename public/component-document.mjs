export const componentGalleryPage = Object.freeze({
  path: '/components',
  title: 'UI Component Gallery – Browse & Preview | Ilia Cache',
  description: 'Browse a free directory of UI components. Filter by category or source, view available previews, and open the original component page.',
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
