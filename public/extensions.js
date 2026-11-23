import { createLibrarySync } from './library-sync.mjs';
import { loadBuiltinComponents } from './builtin-components.mjs';
import { installComponentWorkspace } from './component-workspace-ui.mjs';
import { createLocalComponentActions } from './local-component-actions.mjs';
import { installWorkbenchDirectory } from './workbench-directory.mjs';
import { installLocalSiteCollections } from './local-site-collections.mjs';

export {
  COMPONENT_CATEGORIES, canDistributeSource,
  isComponentRecord as isComponent, isSoundEffect, isLibraryComponent, sourceName, sourcePage,
} from './component-taxonomy.mjs';

export { componentCategory } from './component-categories.mjs';

export function builtinResources(read = async (url, format) => (await fetch(url))[format]()) {
  return loadBuiltinComponents(read);
}

export function installExtensions(host) {
  const sync = createLibrarySync({
    getState: host.getState,
    initialState: host.syncBaseline,
    async send(body) {
      const response = await fetch('/api/library', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
      });
      if (!response.ok) throw new Error('保存失败');
    },
  });
  let syncTimer;
  host.sync = () => {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => sync.flush().catch(() => {
      host.toast('浏览器已保存，本机文件同步失败。下次保存会重试。');
    }), 350);
  };
  const local = createLocalComponentActions(host, sync.acknowledgeResource);
  installComponentWorkspace(host, { local, directoryInstaller: installWorkbenchDirectory });
  return installLocalSiteCollections(host);
}
