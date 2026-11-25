import assert from 'node:assert/strict';
import test from 'node:test';
import { allowsComponentSource, hasOriginalMotionBundle, isComponentRecord, normalizeOriginalMotionRecord, sourcePage } from '../public/component-taxonomy.mjs';
import { componentBrowseCategory } from '../public/component-categories.mjs';
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

test('旧原创动效按现有细分类显示，保留作者、源码策略和用户分类', () => {
  const old = {
    id: 'ilia-motion-marquee', primarySourceKind: 'original', primarySourceAuthor: 'Ilia',
    sourceShort: 'Ilia原创实现', tags: ['Ilia 原创实现', '循环'], componentCategory: '文字',
    sourcePolicy: 'bundled-source', filePackage: 'ilia-motion-marquee', license: '作者随附许可',
  };
  const record = normalizeOriginalMotionRecord(old);
  assert.deepEqual(record, { ...old, sourceShort: '原创', tags: ['循环'], componentCategory: '打字与滚动' });
  assert.equal(componentBrowseCategory(record), '打字与滚动');
  assert.equal(normalizeOriginalMotionRecord(record), record);
  assert.equal(hasOriginalMotionBundle(record), true);
  assert.equal(hasOriginalMotionBundle({ ...record, sourcePolicy: 'source-link-only' }), false);

  const chosen = { ...old, componentCategory: '文字特效', motionPattern: { category: 'loop' } };
  assert.equal(normalizeOriginalMotionRecord(chosen).componentCategory, '文字特效');
  const thirdParty = { ...old, id: 'other-marquee' };
  assert.equal(normalizeOriginalMotionRecord(thirdParty), thirdParty);

  const imported = normalizeOriginalMotionRecord({
    id: 'ilia-motion-magnetic', primarySourceKind: 'original', motionPattern: { category: 'hover' },
  });
  assert.equal(imported.componentCategory, '悬停与按压');
});
