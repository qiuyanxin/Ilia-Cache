import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const directory = await mkdtemp(join(tmpdir(), 'ilia-component-records-'));
process.env.ILIA_DATA_DIR = directory;
const {
  addPreviewCandidate, getComponentRecord, readComponentPreview, saveComponentRecord, selectPreviewCandidate
} = await import('../component-records.mjs');
const { saveLibrary, loadLibrary, rebuildComponentIndex } = await import('../library-store.mjs');
const { componentPackage } = await import('../component-packages.mjs');
after(() => rm(directory, { recursive: true, force: true }));

test('粘贴 HTML 生成预览，原始文件留在独立源码包，旧资料可继续读取', async () => {
  const originalFile = { name: 'index.html', content: '<button onclick="this.textContent=\'On\'">Off</button>' };
  const { id, filePackage, preview, previewStatus, ...record } = await saveComponentRecord({
    name: '本地 HTML 测试', category: '按钮与输入', prompt: '  保留原始提示词  ', framework: 'html', files: [originalFile]
  });
  assert.equal(record.url, '');
  assert.equal(record.prompt, '  保留原始提示词  ');
  assert.equal(record.files, undefined);
  assert.equal(previewStatus.status, 'ready');
  assert.deepEqual((await componentPackage(filePackage)).files, [originalFile]);
  assert.equal(String(await readComponentPreview(preview.url.split('/').at(-1))), originalFile.content);

  const failed = await saveComponentRecord({
    id, name: record.name, prompt: '新提示词', framework: 'html',
    files: [{ name: 'index.html', content: '<script src="missing.js"></script>' }]
  });
  assert.equal(failed.previewStatus.status, 'needs-input');
  assert.equal(failed.preview.stale, true);
  assert.equal(failed.preview.url, preview.url);
  assert.deepEqual(failed.promptHistory, [record.prompt]);
  assert.notEqual(failed.filePackage, filePackage);
  assert.equal((await getComponentRecord(id)).filePackage, failed.filePackage);
});

test('链接去重，Agent 候选提交幂等，旧网页的使用记录不会覆盖已选预览', async () => {
  const url = 'https://example.com/components/dropdown';
  const [saved, duplicate] = await Promise.all([
    saveComponentRecord({ name: '', url, category: '导航', files: [] }),
    saveComponentRecord({ name: '副本', url, category: '导航', files: [] })
  ]);
  assert.equal(saved.id, duplicate.id);
  assert.equal(saved.name, 'dropdown');
  const candidate = {
    kind: 'video', url: 'https://cdn.example.com/dropdown.webm', sourcePageUrl: url, provenance: '官方演示', duration: 4
  };
  const [first, second] = await Promise.all([
    addPreviewCandidate(saved.id, candidate), addPreviewCandidate(saved.id, candidate)
  ]);
  assert.equal(first.previewCandidates.length, 1);
  assert.equal(second.previewCandidates.length, 1);
  assert.equal(first.referencePreview, undefined);
  await selectPreviewCandidate(saved.id, first.previewCandidates[0].id);
  await mkdir(join(directory, 'assets'), { recursive: true });
  await writeFile(join(directory, 'assets', 'abcd.png'), 'synthetic test attachment');
  const enriched = { ...candidate, poster: '/api/assets/abcd.png', width: 1280, height: 720 };
  const withPoster = await addPreviewCandidate(saved.id, enriched);
  assert.equal(withPoster.previewCandidates.length, 1);
  assert.equal(withPoster.referencePreview.id, first.previewCandidates[0].id);
  assert.equal(withPoster.referencePreview.created, first.previewCandidates[0].created);
  assert.equal(withPoster.referencePreview.poster, enriched.poster);
  assert.equal((await addPreviewCandidate(saved.id, enriched)).componentRevision, withPoster.componentRevision);

  await saveLibrary({
    resources: [{ ...saved, usage: [{ project: '迁移样本', location: '下拉菜单' }] }],
    lessons: [], _patch: true, _changedResources: [saved.id]
  });
  const current = await getComponentRecord(saved.id);
  assert.equal(current.referencePreview.url, candidate.url);
  assert.equal(current.referencePreview.poster, enriched.poster);
  assert.equal(current.referencePreview.width, 1280);
  assert.equal(current.referencePreview.height, 720);
  assert.equal(current.usage[0].project, '迁移样本');
  assert.equal(current.name, saved.name);
  assert.ok(await readFile(join(directory, 'component-index.json'), 'utf8'));
  assert.equal((await loadLibrary()).resources.filter(row => row.id === saved.id).length, 1);
  await assert.rejects(addPreviewCandidate(saved.id, { ...candidate, url: 'http://127.0.0.1/test.webm' }), /公开域名/);
  await assert.rejects(addPreviewCandidate(saved.id, { ...candidate, poster: '/api/assets/abcd.webm' }), /附件类型/);
  await assert.rejects(addPreviewCandidate(saved.id, { ...enriched, kind: 'image' }), /只有视频/);
  await assert.rejects(selectPreviewCandidate(saved.id, 'unregistered'), /未找到/);
});

test('组件索引写到一半失败时，后续保存会补齐之前遗漏的清单', async () => {
  const { id } = await saveComponentRecord({
    name: '索引修复样本', url: 'https://example.com/index/repair', prompt: '旧原文'
  });
  const manifest = join(directory, 'components', id, 'manifest.json');
  const marker = join(directory, 'component-index.revision');
  const previousRevision = await readFile(marker, 'utf8');
  await rm(manifest);
  await mkdir(manifest);
  const updated = await saveComponentRecord({ id, prompt: '新原文' });
  assert.equal(updated.prompt, '新原文');
  assert.equal((await getComponentRecord(id)).prompt, '新原文');
  assert.equal(await readFile(marker, 'utf8'), previousRevision);

  await rm(manifest, { recursive: true });
  await saveLibrary({ resources: [], lessons: [], _patch: true });
  assert.equal(JSON.parse(await readFile(manifest, 'utf8')).prompt, '新原文');
  assert.notEqual(await readFile(marker, 'utf8'), previousRevision);

  await rm(manifest);
  const original = await readFile(join(directory, 'library.json'), 'utf8');
  assert.equal(await rebuildComponentIndex(), true);
  assert.equal(await readFile(join(directory, 'library.json'), 'utf8'), original);
  assert.equal(JSON.parse(await readFile(manifest, 'utf8')).prompt, '新原文');
});
