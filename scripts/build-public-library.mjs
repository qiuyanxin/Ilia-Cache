import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const state = JSON.parse(await readFile(new URL('../data/library.json', import.meta.url), 'utf8'));
const publicDir = new URL('../public/', import.meta.url);
const packageDir = new URL('../public/component-packages/', import.meta.url);

const localPreviewRoots = [
  '/component-posters/',
  '/motion/',
  '/native-preview.html',
  '/previews/',
  '/sounds/'
];

function isPublishedPreview(value) {
  if (typeof value !== 'string' || !value.startsWith('/')) return true;
  if (!localPreviewRoots.some(root => value.startsWith(root))) return false;
  return existsSync(new URL(value.slice(1).split('?')[0], publicDir));
}

function publicResource(resource) {
  const copy = structuredClone(resource);
  delete copy.files;
  delete copy.sourceFiles;
  delete copy.filePackage;
  for (const key of ['previewUrl', 'externalPreview', 'thumbnailFrame', 'localPoster']) {
    if (!isPublishedPreview(copy[key])) delete copy[key];
  }
  return copy;
}

const resources = state.resources.filter(resource => !resource.archived).map(publicResource);
await writeFile(new URL('seed.json', publicDir), `${JSON.stringify(resources, null, 2)}\n`);

await rm(packageDir, { recursive: true, force: true });
await mkdir(packageDir, { recursive: true });

let packages = 0;
for (const resource of state.resources) {
  if (resource.archived || resource.license !== 'MIT' || !resource.filePackage) continue;
  const source = new URL(`../data/packages/${resource.filePackage}.json`, import.meta.url);
  try {
    await stat(source);
  } catch {
    continue;
  }
  await copyFile(source, new URL(`${resource.filePackage}.json`, packageDir));
  const published = resources.find(item => item.id === resource.id);
  if (published) {
    published.filePackage = resource.filePackage;
    published.sourceFiles = resource.sourceFiles || [];
  }
  packages += 1;
}

await writeFile(new URL('seed.json', publicDir), `${JSON.stringify(resources, null, 2)}\n`);
console.log(`Published ${resources.length} resources and ${packages} MIT source packages.`);
