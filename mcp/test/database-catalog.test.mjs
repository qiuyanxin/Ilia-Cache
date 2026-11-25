import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { withLibraryWrite } from '../../lib/library-sqlite.mjs';
import { createCatalog, createPublicCatalog } from '../catalog.mjs';
import { searchCatalog, searchDocument } from '../../lib/catalog-search.mjs';

test('本机 MCP 可通过 SQLite 索引直接查私人条目和已核验证据', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'ilia-database-mcp-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await withLibraryWrite(dir, (_, save) => save({
    resources: [{
      id: 'database-slider', kind: '案例', category: '组件', componentCategory: '图集与轮播', name: '测试图片对比',
      description: '拖动分隔线，松手回弹。',
      evidence: { keyboard: { value: true, status: 'verified', source: '本机键盘验收' } },
    }],
    lessons: [],
  }));
  const catalog = createCatalog({ dataDir: dir });
  const results = await catalog.searchResources({
    intent: '给图片找一个能够拖动分隔线的对比组件', kind: 'component',
    required: { keyboard: true }, limit: 5,
  });
  assert.equal(results.eligible[0].id, 'database-slider');
  assert.equal(results.eligible[0].evidence.keyboard, 'verified');
  assert.equal((await catalog.record('component', 'database-slider')).summary.title, '测试图片对比');
});

test('公开新搜索命中图像对比，缺少键盘核验时只作为待核实候选', async () => {
  const catalog = createPublicCatalog({ baseUrl: 'https://ilia.example.org' });
  const results = await catalog.searchResources({ intent: '拖动分隔线的前后图片对比，松手回弹',
    kind: 'component', category: '图集与轮播', required: { keyboard: true }, limit: 5 });
  assert.equal(results.eligible.length, 0);
  assert.ok(results.nearMatches.some(hit => hit.id === '4cbfeca4-e4db-402e-8b1f-a1aa0aa96012'));
  await assert.rejects(catalog.file('4cbfeca4-e4db-402e-8b1f-a1aa0aa96012', 'PROMPT.md'),
    /source_restricted/);
  await assert.rejects(catalog.record('component', 'motion-prompt-087', { releaseId: 'stale' }),
    /release_changed/);
});

test('搜索排序分开对待明确不满足、缺证据和已核验', () => {
  const candidates = [
    { id: 'good', evidence: { keyboard: { value: true, status: 'verified', source: '自动化记录' } } },
    { id: 'fails', evidence: { keyboard: { value: false, status: 'verified', source: '人工记录' } } },
    { id: 'unknown', evidence: { keyboard: { value: true, status: 'draft', source: '待确认' } } },
  ].map(row => searchDocument({ ...row, title: '弹出菜单' }));
  const results = searchCatalog({ version: 'r1', candidates }, { intent: '弹出菜单', required: { keyboard: true } });
  assert.deepEqual(results.eligible.map(hit => hit.id), ['good']);
  assert.deepEqual(results.nearMatches.map(hit => hit.evidence.keyboard), ['not_met', 'unknown']);
});
