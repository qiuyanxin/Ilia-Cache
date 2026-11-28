import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORKBENCH_TABS,
  WORKBENCH_TYPES,
  captureType,
  filterByWorkbenchType,
  referenceType,
} from '../public/workbench-taxonomy.mjs';

test('工作台一级分类只保留项目、采集和收藏', () => {
  assert.deepEqual(WORKBENCH_TABS, [
    ['projects', '项目'],
    ['capture', '采集'],
    ['favorites', '收藏'],
  ]);
});

test('工作台资源类型与外部导航使用同一套名称', () => {
  assert.deepEqual(Object.values(WORKBENCH_TYPES), [
    '全部', '网站', '组件', '音效', '页面', '字体', '视觉参考',
  ]);
});

test('旧采集类型映射到新资源类型但不改原记录', () => {
  const aesthetic = { category: '审美素材', aesthetic: true };
  const component = { category: '组件' };
  const page = { category: '网页参考' };
  const pending = { category: '待整理' };
  assert.equal(captureType(aesthetic), 'visual');
  assert.equal(captureType(component), 'component');
  assert.equal(captureType(page), 'page');
  assert.equal(captureType(pending), 'unclassified');
  assert.equal(aesthetic.category, '审美素材');
});

test('项目引用类型沿用外部资源名称', () => {
  assert.equal(referenceType({ type: 'website' }), 'website');
  assert.equal(referenceType({ type: 'font' }), 'font');
  assert.equal(referenceType({ type: 'page' }), 'page');
  assert.equal(referenceType({ type: 'style' }), 'visual');
  assert.equal(referenceType({ type: 'aesthetic' }), 'visual');
});

test('统一筛选器按映射后的资源类型过滤', () => {
  const rows = [{ category: '审美素材' }, { category: '组件' }, { category: '待整理' }];
  assert.equal(filterByWorkbenchType(rows, 'visual', captureType).length, 1);
  assert.equal(filterByWorkbenchType(rows, 'all', captureType).length, 3);
});

test('待整理只由 inboxDone 状态决定', () => {
  const rows = [{ id: 'new', inboxDone: false }, { id: 'done', inboxDone: true }];
  assert.deepEqual(rows.filter(row => !row.inboxDone).map(row => row.id), ['new']);
});
