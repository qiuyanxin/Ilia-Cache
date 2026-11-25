import assert from 'node:assert/strict';
import test from 'node:test';
import { allowsComponentSource, isComponentRecord, normalizeOriginalMotionRecord, sourcePage } from '../public/component-taxonomy.mjs';
import { isPageRecord } from '../public/page-taxonomy.mjs';

test('显式组件分类及旧记录共用组件识别，归档默认排除', () => {
  assert.equal(isComponentRecord({ componentCategory: '文字' }), true);
  assert.equal(isComponentRecord({ kind: '案例', category: '组件' }), true);
  assert.equal(isComponentRecord({ caseType: '网页参考' }), false);
  assert.equal(isComponentRecord({ componentCategory: '文字', archived: true }), false);
  assert.equal(isComponentRecord({ componentCategory: '文字', archived: true }, { includeArchived: true }), true);
  assert.equal(isPageRecord({ pageCategory: '作品集', archived: true }), false);
  assert.equal(isPageRecord({ pageCategory: '作品集', archived: true }, { includeArchived: true }), true);
});

test('首选已核实组件页，显式源码限制覆盖本机兼容规则', () => {
  const primary = 'https://origin.example.org/component';
  const collected = 'https://library.example.org/capture';
  assert.equal(sourcePage({ sourcePageUrl: primary, sourceUrl: collected }), primary);
  assert.equal(sourcePage({ sourceUrl: primary, url: collected }), primary);
  assert.equal(allowsComponentSource({ sourcePolicy: 'bundled-source' }), true);
  assert.equal(allowsComponentSource({ sourcePolicy: 'official-source-only' }, { allowUnclassified: true }), false);
  assert.equal(allowsComponentSource({}, { allowUnclassified: true }), true);
  assert.equal(allowsComponentSource({}), false);
});

test('旧原创动效按现有用途归类，来源和旧标签互不混用', () => {
  const legacy = {
    id: 'ilia-motion-marquee', componentCategory: '打字与滚动', motionPattern: { category: 'loop' },
    primarySourceKind: 'original', primarySourceAuthor: 'Ilia', sourceShort: 'Ilia原创实现',
    tags: ['Ilia原创实现', '滚动'], filePackage: 'ilia-motion-marquee',
  };
  assert.deepEqual(normalizeOriginalMotionRecord(legacy), {
    ...legacy, componentCategory: '文字', sourceShort: '原创', tags: ['滚动'],
  });
  const unrelated = { ...legacy, id: 'third-party-marquee' };
  assert.equal(normalizeOriginalMotionRecord(unrelated), unrelated);
});
