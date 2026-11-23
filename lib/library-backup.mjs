import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { migrateLibrary } from './library-migration.mjs';
import { checkLibraryDatabase, libraryDatabasePath, withLibraryWrite } from './library-sqlite.mjs';

const assets = ['assets', 'packages', 'previews', 'components', 'component-index.json', 'component-index.revision'];
const manifestName = 'backup-manifest.json';

async function entry(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function copyTree(from, to) {
  const info = await entry(from);
  if (!info) return;
  if (info.isFile()) {
    await copyFile(from, to);
  } else if (info.isDirectory()) {
    await mkdir(to, { mode: 0o700 });
    for (const name of await readdir(from)) await copyTree(join(from, name), join(to, name));
  } else {
    throw new Error('备份资料必须是普通文件或目录：' + basename(from));
  }
}

async function digests(root, directory = root) {
  const files = [];
  for (const name of (await readdir(directory)).sort()) {
    const file = join(directory, name);
    const path = relative(root, file).split(sep).join('/');
    if (path === manifestName) continue;
    const info = await lstat(file);
    if (info.isDirectory()) {
      files.push(...await digests(root, file));
    } else if (info.isFile()) {
      const hash = createHash('sha256');
      for await (const chunk of createReadStream(file)) hash.update(chunk);
      files.push({ path, bytes: info.size, sha256: hash.digest('hex') });
    } else {
      throw new Error('备份含有符号链接或特殊文件：' + path);
    }
  }
  return files;
}

async function stageNewDirectory(destination, write) {
  const target = resolve(destination);
  if (await entry(target)) throw new Error('目标目录已存在，请指定新目录。');
  const stage = await mkdtemp(join(dirname(target), '.ilia-backup-'));
  try {
    const result = await write(stage);
    if (await entry(target)) throw new Error('目标目录已存在，请指定新目录。');
    await rename(stage, target);
    return result;
  } finally {
    await rm(stage, { force: true, recursive: true });
  }
}

export async function backupLibrary(directory, destination) {
  const source = resolve(directory instanceof URL ? fileURLToPath(directory) : directory);
  const target = resolve(destination);
  if (target === source || target.startsWith(source + sep)) throw new Error('请将备份放到资料目录之外。');
  await migrateLibrary(source);
  return stageNewDirectory(target, async stage => {
    await withLibraryWrite(source, async current => {
      // Hold the source write lock while copying files referred to by the snapshot.
      await withLibraryWrite(stage, (_existing, save) => save(current));
      for (const name of assets) await copyTree(join(source, name), join(stage, name));
      const legacy = join(source, 'legacy-library.json');
      await copyTree(await entry(legacy) ? legacy : join(source, 'library.json'), join(stage, 'legacy-library.json'));
      await writeFile(join(stage, 'library.json'), JSON.stringify(current, null, 2) + '\n', { mode: 0o600 });
    });
    const manifest = { version: 1, createdAt: new Date().toISOString(), files: await digests(stage) };
    await writeFile(join(stage, manifestName), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
    await verifyLibraryBackup(stage);
    return { files: manifest.files.length };
  });
}

export async function verifyLibraryBackup(directory) {
  const root = resolve(directory);
  if (!(await lstat(root)).isDirectory()) throw new Error('备份路径必须是普通目录。');
  const manifestFile = join(root, manifestName);
  if (!(await lstat(manifestFile)).isFile()) throw new Error('备份清单必须是普通文件。');
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
  const actual = await digests(root);
  if (manifest?.version !== 1 || !isDeepStrictEqual(manifest.files, actual)) throw new Error('备份文件校验失败。');
  if (!actual.some(file => file.path === basename(libraryDatabasePath(root))) ||
    !actual.some(file => file.path === 'library.json')) throw new Error('备份缺少数据库或 JSON 资料快照。');
  const state = checkLibraryDatabase(root);
  if (!state || !isDeepStrictEqual(state, JSON.parse(await readFile(join(root, 'library.json'), 'utf8')))) {
    throw new Error('备份的数据库与 JSON 快照不一致。');
  }
  return { files: actual.length };
}

export async function restoreLibraryBackup(directory, destination) {
  const source = resolve(directory);
  const target = resolve(destination);
  if (target === source || target.startsWith(source + sep)) throw new Error('请将资料恢复到备份目录之外。');
  await verifyLibraryBackup(source);
  return stageNewDirectory(target, async stage => {
    for (const name of await readdir(source)) await copyTree(join(source, name), join(stage, name));
    return verifyLibraryBackup(stage);
  });
}
