import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

test('共享浏览器入口的依赖均已列入公开清单，且不依赖本机模块', async () => {
  const assets = new Set(JSON.parse(await readFile(new URL('../lib/workspace-browser-assets.json', import.meta.url), 'utf8')));
  const { metafile } = await build({
    absWorkingDir: fileURLToPath(new URL('../', import.meta.url)),
    entryPoints: [
      'public/component-workspace-ui.mjs', 'public/component-navigation.mjs', 'public/workspace-chrome.mjs',
    ],
    bundle: true,
    platform: 'browser',
    metafile: true,
    write: false,
    outdir: 'shared-workspace-test',
  });
  const localEntryPoints = new Set(['extensions.js', 'library-sync.mjs', 'builtin-components.mjs']);
  const inputs = Object.keys(metafile.inputs);
  const localDependencies = inputs.filter(path => {
    const name = basename(path);
    return localEntryPoints.has(name) || name.startsWith('local-');
  });
  assert.deepEqual(localDependencies, []);
  assert.deepEqual(inputs.filter(path => !path.startsWith('public/') || !assets.has(path.slice('public/'.length))), []);
});
