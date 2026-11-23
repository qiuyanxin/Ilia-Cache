import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { buildPublicCatalog } from '../lib/public-catalog.mjs';

const run = promisify(execFile);
const script = fileURLToPath(new URL('../scripts/build-public-library.mjs', import.meta.url));
const id = 'motion-prompt-001';
const origin = 'https://showheyohtaki.github.io/motion-prompt/#001';
const names = [id + '.txt', 'LICENSE', 'ORIGIN.json'];
const record = {
  id, name: '动画样例', url: origin, caseType: '组件', componentCategory: '动效与镜头',
  sourceShort: 'Motion Prompt', sourcePageUrl: origin, sourcePageKind: 'primary',
  sourcePolicy: 'bundled-source', license: 'MIT', filePackage: id, sourceFiles: names.map(name => ({ name })),
  usage: [{ project: 'private' }], previewCandidates: [{ url: '/api/assets/private.png' }],
  media: [{ type: 'image', url: '/api/assets/private.png' }],
};
const bundle = { id, files: [
  { name: names[0], content: 'render synthetic example' },
  { name: 'LICENSE', content: 'MIT test fixture' },
  { name: 'ORIGIN.json', content: JSON.stringify({ source: origin, license: 'MIT' }) },
] };

async function prepare(t) {
  const dir = await mkdtemp(join(tmpdir(), 'ilia-export-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const input = join(dir, 'reviewed.json');
  const packages = join(dir, 'packages');
  const output = join(dir, 'release');
  await mkdir(packages);
  const restricted = {
    ...record, id: 'reactbits-sample', url: 'https://reactbits.dev/backgrounds/aurora', sourcePageUrl: '',
    filePackage: 'reactbits-sample', sourcePolicy: 'official-source-only',
  };
  await writeFile(input, JSON.stringify({ resources: [record, restricted] }));
  await writeFile(join(packages, 'reactbits-sample.json'), JSON.stringify({ id: restricted.id, files: [{ name: 'private.txt', content: 'test fixture' }] }));
  const packagePath = join(packages, id + '.json');
  const build = (destination = output) => run(process.execPath, [script, '--reviewed-input', input, '--output', destination]);
  return { dir, output, packagePath, build };
}

test('reviewed export publishes exactly the allowed source in a complete independent directory', async t => {
  const { output, packagePath, build } = await prepare(t);
  await writeFile(packagePath, JSON.stringify({ ...bundle, files: [...bundle.files, { name: 'unlisted.txt', content: 'omitted' }] }));
  await build();
  const seed = JSON.parse(await readFile(join(output, 'seed.json'), 'utf8'));
  const projected = buildPublicCatalog(seed);
  assert.deepEqual(projected.components.map(entry => [entry.id, entry.files]), [[id, names], ['reactbits-sample', []]]);
  assert.equal(Object.hasOwn(seed[0], 'usage'), false);
  assert.equal(Object.hasOwn(seed[0], 'previewCandidates'), false);
  assert.deepEqual(seed[0].media, []);
  assert.deepEqual(await readdir(join(output, 'component-packages')), [id + '.json']);
  assert.deepEqual(JSON.parse(await readFile(join(output, 'component-packages', id + '.json'), 'utf8')), bundle);
  await assert.rejects(build(), error => /公开导出目录已存在/.test(error.stderr));
});

test('missing, malformed and duplicate package data leave any prior export intact', async t => {
  const { dir, output, packagePath, build } = await prepare(t);
  await assert.rejects(build(), error => /已审核源码包无法读取/.test(error.stderr));
  await assert.rejects(readdir(output), { code: 'ENOENT' });
  await writeFile(packagePath, JSON.stringify(bundle));
  await build();
  const seed = join(output, 'seed.json');
  const before = await readFile(seed);
  const candidate = join(dir, 'candidate');
  for (const invalid of ['{', JSON.stringify({ ...bundle, files: [...bundle.files, bundle.files[0]] }),
    JSON.stringify({ ...bundle, files: bundle.files.map(file => file.name === 'LICENSE' ? { ...file, content: '  ' } : file) })]) {
    await writeFile(packagePath, invalid);
    await assert.rejects(build(candidate), error => /源码包/.test(error.stderr));
    await assert.rejects(readdir(candidate), { code: 'ENOENT' });
    assert.deepEqual(await readFile(seed), before);
  }
});
