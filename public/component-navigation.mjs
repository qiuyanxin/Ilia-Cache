/** Keep a gallery's component URL and detail dialog in step with browser history. */
export function installComponentNavigation({
  dialog, routeId, detailUrl, galleryUrl, hasComponent, showDetail, restoreDirectoryFocus, entryState = () => ({}),
  readDetailTab, selectDetailTab, onRouteChange,
}) {
  let presentedId;
  let returningId;

  function sync(fetchSource = false) {
    const id = routeId();
    const previousId = returningId ?? presentedId;
    returningId = undefined;
    if (!id || !hasComponent(id)) {
      presentedId = undefined;
      onRouteChange?.(undefined, !id && previousId ? { id: previousId, reveal: false } : undefined);
      if (dialog.open) dialog.close();
      if (!id && previousId && restoreDirectoryFocus) {
        // Allow the browser to restore the original directory scroll position first.
        requestAnimationFrame(() => {
          if (!routeId() && !dialog.open) restoreDirectoryFocus(previousId);
        });
      }
      return;
    }
    const tab = readDetailTab?.();
    onRouteChange?.(id);
    if (id === presentedId && dialog.open) {
      if (tab) selectDetailTab?.(tab);
      return;
    }
    presentedId = id;
    showDetail(id, { fetchSource, tab });
  }

  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    const id = presentedId;
    presentedId = undefined;
    if (!id || id !== routeId()) return;
    if (history.state?.iliaComponent === id) {
      returningId = id;
      history.back();
    } else {
      history.replaceState(entryState(), '', typeof galleryUrl === 'function' ? galleryUrl() : galleryUrl);
      onRouteChange?.(undefined, { id, reveal: true });
      restoreDirectoryFocus?.(id, { reveal: true });
    }
  });

  return {
    open(id) {
      if (!hasComponent(id)) return;
      if (id !== routeId()) history.pushState({ ...entryState(), iliaComponent: id }, '', detailUrl(id));
      sync(true);
    },
    sync,
  };
}
