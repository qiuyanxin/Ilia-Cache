import assert from 'node:assert/strict';
import test from 'node:test';
import { selectComponentRecords } from '../public/component-directory.mjs';
import { planDirectoryCards, splitComponentLanes } from '../public/component-lanes.mjs';
import { createComponentSearch, createSearchRanker, prepareSearchQuery } from '../public/component-search.mjs';
import { componentFilterQuery, readComponentFilters } from '../public/component-directory-url.mjs';

test('服务端首屏取完整目录的每列开头，且每种分列最多显示 24 张卡片', () => {
  const items = Array.from({ length: 850 }, (_, index) => index);
  const plan = planDirectoryCards(items, 24);
  assert.equal(plan.length, 52);
  for (const count of [1, 2, 3]) {
    const choices = plan.filter(card => card.slots[count]);
    assert.equal(choices.length, 24);
    const lanes = splitComponentLanes(items, count).map(lane => lane.slice(0, 24 / count));
    for (const { item, slots } of choices) {
      const { column, row } = slots[count];
      assert.equal(lanes[column - 1][row - 1], item);
    }
  }
  assert.equal(planDirectoryCards(items).length, 850);
  assert.deepEqual(planDirectoryCards([]), []);
});

test('目录按名称自然排序，共用分类和来源搜索，归档条目不进入列表', () => {
  const records = [
    { id: 'ten', name: '组件十', originalName: 'Demo 10', componentCategory: '按钮与输入', sourceShort: 'Motion Lab' },
    { id: 'two', name: '组件二', originalName: 'Demo 2', caseType: '组件', componentCategory: '文字', sourceShort: 'Motion Lab' },
    { id: 'archived', name: '归档', componentCategory: '按钮与输入', archived: true, sourceShort: 'Motion Lab' },
    { id: 'page', name: '页面', caseType: '网页参考', sourceShort: 'Motion Lab' },
    { id: 'mentions', name: '提到其他来源', originalName: 'Demo 20', caseType: '组件', note: 'See Motion Lab.', sourceShort: 'Other Source' },
  ];
  assert.deepEqual(selectComponentRecords(records, { query: 'motion lab' }).map(record => record.id), ['two', 'ten', 'mentions']);
  assert.deepEqual(selectComponentRecords(records, { source: 'Motion Lab' }).map(record => record.id), ['two', 'ten']);
  assert.deepEqual(selectComponentRecords(records, { category: '文字' }).map(record => record.id), ['two']);
});

test('同一结果顺序在不同预览高度下分列相同，切换列数后保持阅读顺序', () => {
  const mockRecords = [1, 2, 3, 4, 5, 6, 7].map(id => ({ id }));
  const lanes = (records, count) => splitComponentLanes(records, count).map(items => items.map(({ id }) => id));
  const firstHost = mockRecords.map(record => ({ ...record, height: record.id * 10 }));
  const secondHost = mockRecords.map(record => ({ ...record, height: 400 / record.id }));
  assert.deepEqual(lanes(firstHost, 3), [[1, 2, 3], [4, 5], [6, 7]]);
  assert.deepEqual(lanes(firstHost, 3), lanes(secondHost, 3));
  assert.deepEqual(lanes(firstHost, 2), [[1, 2, 3, 4], [5, 6, 7]]);
  assert.deepEqual(lanes(firstHost, 1), [[1, 2, 3, 4, 5, 6, 7]]);
});

test('连续检索复用评分器，并读到原地修改后的提示词', () => {
  let prompt = '蓝色原始演示';
  let reads = 0;
  const rank = createSearchRanker({ id: 'demo', title: 'DEMO', metadata: '主题' }, () => {
    reads++;
    return prompt;
  });
  assert.equal(rank(prepareSearchQuery('DEMO')), Number.MAX_SAFE_INTEGER);
  assert.equal(rank(prepareSearchQuery('主题')), 3);
  assert.equal(reads, 0);
  assert.equal(rank(prepareSearchQuery('蓝色 原始')), 2);
  assert.equal(reads, 1);
  prompt = '绿色新版';
  assert.equal(rank(prepareSearchQuery('蓝色')), -1);
  assert.equal(rank(prepareSearchQuery('绿色')), 1);
});

test('公开快照和浏览器记录的分类、来源及匹配顺序一致', () => {
  const records = [
    { id: 'ten', title: '动效十', originalName: 'Demo 10', sourceName: 'Alpha', category: '卡片', prompt: 'Loop', sourcePageUrl: 'https://example.com/ten' },
    { id: 'two', title: '动效二', originalName: 'Demo 2', sourceName: 'Alpha', category: '卡片', prompt: 'Loop', sourcePageUrl: 'https://example.com/two' },
    { id: 'nav', title: '动效菜单', originalName: 'Loop Menu', sourceName: 'Beta', category: '菜单与导航' },
  ];
  const browser = records.map(({ title, category, sourceName, ...record }) => ({
    ...record, name: title, componentCategory: category, sourceShort: sourceName,
  }));
  const select = createComponentSearch(records);
  const ids = rows => rows.map(({ id }) => id);
  for (const [filters, expected] of [
    [{ query: 'Loop' }, ['nav', 'two', 'ten']],
    [{ query: 'Loop', source: 'Alpha', category: '卡片' }, ['two', 'ten']],
    [{ query: 'example.com' }, ['two', 'ten']],
    [{ query: 'missing', source: 'Alpha' }, []],
  ]) {
    assert.deepEqual(ids(select(filters)), expected);
    assert.deepEqual(ids(selectComponentRecords(browser, { ...filters, readonly: true })), expected);
  }
});

test('公开目录链接可往返保留多项筛选、特殊字符及原有查询参数', () => {
  const filters = { category: '图集与轮播', source: 'Bencho', query: '对比 & # + ?' };
  const suffix = componentFilterQuery(filters, '?focus=search&tracking=link&q=old');
  assert.deepEqual(readComponentFilters(suffix), filters);
  const params = new URLSearchParams(suffix);
  assert.equal(params.get('focus'), 'search');
  assert.equal(params.get('tracking'), 'link');
  assert.deepEqual(readComponentFilters('?category=unknown'), { category: '', source: '', query: '' });
  assert.deepEqual(readComponentFilters('?q=de%00mo&q=duplicate&source=unknown', { sources: new Set(['Bencho']) }), {
    category: '', source: '', query: 'demo',
  });
  assert.equal(componentFilterQuery({}, suffix), '?focus=search&tracking=link');
});
