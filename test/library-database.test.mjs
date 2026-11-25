import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { setTimeout } from 'node:timers/promises';
import { backupLibrary, restoreLibraryBackup, verifyLibraryBackup } from '../lib/library-backup.mjs';
import { importBrowserLibrary, migrateLibrary } from '../lib/library-migration.mjs';
import { findStoredLibraryCandidates, readStoredLibrary, withLibraryWrite } from '../lib/library-sqlite.mjs';
import { searchTerms } from '../lib/catalog-search.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'ilia-library-db-'));
  t.after(() => rm(root, { force: true, recursive: true }));
  const data = join(root, 'data');
  await mkdir(data);
  return { root, data };
}

const component = { id: 'private-contrast', name: '图片对比滑块', componentCategory: '本机预览',
  kind: '案例', favorite: true, filePackage: 'private-package', sourceRevision: 'old-revision' };
const legacy = {
  updatedAt: '2026-11-23T12:00:00.000Z', resources: [component], lessons: [],
  inbox: [{ id: 'local-inbox', name: '图像记录', text: '私人资料', attachment: '/api/assets/a1.png' }],
  projects: [{ id: 'local-project', name: '私人项目', componentIds: [component.id] }],
  styles: [{ id: 'local-style', name: '原始水墨风格', prompt: '原始提示词' }],
  componentCart: [component.id], siteOverrides: { 'example.com': { favorite: true } },
};

test('SQLite 保留旧资料原字节，补齐公开种子并按类型检索本机数据', async t => {
  const { data } = await fixture(t);
  const original = JSON.stringify(legacy, null, 4);
  const json = join(data, 'library.json');
  await writeFile(json, original);
  assert.equal(readStoredLibrary(data), null);
  assert.equal(findStoredLibraryCandidates(data), null);
  const preview = await migrateLibrary(data, { dryRun: true });
  assert.equal(preview.source, 'json');
  assert.ok(preview.added > 0);
  assert.equal(readStoredLibrary(data), null);

  const migrated = await migrateLibrary(data);
  assert.equal(migrated.changed, true);
  const stored = readStoredLibrary(data);
  assert.deepEqual(stored.resources[0], component);
  assert.equal(stored.resources.length, legacy.resources.length + migrated.added);
  assert.deepEqual({ ...stored, resources: legacy.resources }, legacy);
  assert.equal(await readFile(json, 'utf8'), original);
  assert.equal((await migrateLibrary(data)).changed, false);
  assert.equal(findStoredLibraryCandidates(data, { id: component.id })[0].id, component.id);
  const search = (query, kind, category) => findStoredLibraryCandidates(data, {
    terms: searchTerms(query), kind, category, limit: 20,
  }).map(item => item.id);
  assert.deepEqual(search('before after image', 'component', '本机预览'), [component.id]);
  assert.deepEqual(search('水墨', 'style'), ['local-style']);
  assert.deepEqual(search('私人项目', 'project'), ['local-project']);
  assert.deepEqual(search('图片', 'capture'), ['local-inbox']);
});

test('已有 SQLite 的旧原创记录升级分类及检索索引，保留同库资料', async t => {
  const { data } = await fixture(t);
  const old = {
    id: 'ilia-motion-marquee', primarySourceKind: 'original', name: '我的跑马灯',
    sourceShort: 'Ilia原创实现', tags: ['Ilia原创实现', '循环'], componentCategory: '文字',
    filePackage: 'local-marquee', favorite: true,
  };
  await withLibraryWrite(data, (_, save) => save({ ...legacy, resources: [old, component] }));
  const check = await migrateLibrary(data, { dryRun: true });
  assert.equal(check.state.resources[0].sourceShort, '原创');
  assert.equal(readStoredLibrary(data).resources[0].sourceShort, 'Ilia原创实现');
  assert.equal((await migrateLibrary(data)).changed, true);
  assert.deepEqual(readStoredLibrary(data), {
    ...legacy,
    resources: [{ ...old, sourceShort: '原创', tags: ['循环'], componentCategory: '打字与滚动' }, component],
  });
  assert.equal(findStoredLibraryCandidates(data, { id: old.id, source: '原创', category: '打字与滚动' }).length, 1);
  assert.equal(findStoredLibraryCandidates(data, { id: old.id, source: 'Ilia原创实现' }).length, 0);
  assert.equal((await migrateLibrary(data)).changed, false);
});

test('SQLite 写入互斥，失败的事务不留下状态或搜索索引', async t => {
  const { data } = await fixture(t);
  await migrateLibrary(data);
  const first = withLibraryWrite(data, async (current, save) => {
    await setTimeout(125);
    save({ ...current, lessons: [{ id: 'first', title: '第一堂课' }] });
  });
  const second = withLibraryWrite(data, (current, save) => {
    assert.equal(current.lessons[0].id, 'first');
    save({ ...current, lessons: [...current.lessons, { id: 'second', title: '第二堂课', archived: true }] });
  });
  await Promise.all([first, second]);
  assert.equal(findStoredLibraryCandidates(data, { kind: 'lesson', id: 'second' }).length, 0);
  assert.equal(findStoredLibraryCandidates(data, { kind: 'lesson', id: 'second', includeArchived: true }).length, 1);
  await assert.rejects(withLibraryWrite(data, (current, save) => {
    save({ ...current, lessons: [{ id: 'aborted', title: '写入回滚' }] });
    throw new Error('aborted');
  }), /aborted/);
  assert.deepEqual(readStoredLibrary(data).lessons.map(item => item.id), ['first', 'second']);
  assert.equal(findStoredLibraryCandidates(data, { kind: 'lesson', id: 'aborted' }).length, 0);
});

test('浏览器独有资料可补入，同 ID 和设置冲突保存两份原值', async t => {
  const { root, data } = await fixture(t);
  await writeFile(join(data, 'library.json'), JSON.stringify(legacy));
  const json = join(root, 'browser.json');
  const report = join(root, 'conflicts.json');
  await writeFile(json, JSON.stringify({
    version: 1, resources: [{ ...component, favorite: false }, { id: 'browser-only', name: '旧浏览器收藏' }],
    componentCart: ['browser-only'], lessons: [{ id: 'browser-note', title: '旧浏览器笔记' }],
  }));
  assert.deepEqual(await importBrowserLibrary(data, json, report), { added: 2, conflicts: 2 });
  const saved = readStoredLibrary(data);
  assert.equal(saved.resources.find(item => item.id === component.id).favorite, true);
  assert.equal(saved.resources.find(item => item.id === 'browser-only').name, '旧浏览器收藏');
  assert.deepEqual(saved.componentCart, legacy.componentCart);
  const result = JSON.parse(await readFile(report, 'utf8'));
  assert.deepEqual(result.conflicts[0].current, component);
  assert.equal(result.conflicts[0].browser.favorite, false);
  assert.deepEqual(result.conflicts[1].browser, ['browser-only']);
  await assert.rejects(importBrowserLibrary(data, json, report), { code: 'EEXIST' });
});

test('完整备份校验 SQLite 和附件，恢复只写新目录', async t => {
  const { root, data } = await fixture(t);
  const original = JSON.stringify(legacy, null, 4);
  await writeFile(join(data, 'library.json'), original);
  const files = ['assets/a1.png', 'packages/private-package.json', 'previews/a1.html', 'components/private/PROMPT.md'];
  for (const name of files) {
    await mkdir(join(data, name, '..'), { recursive: true });
    await writeFile(join(data, name), '测试文件 ' + name);
  }
  const backup = join(root, 'backup');
  const restored = join(root, 'restored');
  assert.equal((await backupLibrary(data, backup)).files, files.length + 3);
  assert.equal((await verifyLibraryBackup(backup)).files, files.length + 3);
  await restoreLibraryBackup(backup, restored);
  assert.deepEqual(readStoredLibrary(restored), readStoredLibrary(data));
  assert.equal(await readFile(join(restored, 'legacy-library.json'), 'utf8'), original);
  for (const name of files) assert.equal(await readFile(join(restored, name), 'utf8'), '测试文件 ' + name);
  await assert.rejects(restoreLibraryBackup(backup, restored), /目标目录已存在/);
  await writeFile(join(backup, files[0]), 'modified');
  await assert.rejects(restoreLibraryBackup(backup, join(root, 'wrong')), /备份文件校验失败/);
  await symlink(join(data, 'library.json'), join(data, 'assets', 'link'));
  await assert.rejects(backupLibrary(data, join(root, 'backup-with-link')), /必须是普通文件或目录/);
  assert.equal(await readFile(join(data, 'library.json'), 'utf8'), original);
});
