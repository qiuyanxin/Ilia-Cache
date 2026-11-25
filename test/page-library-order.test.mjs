import test from 'node:test';
import assert from 'node:assert/strict';
import { mixPageSources, pageSource } from '../public/page-library.mjs';

test('页面库默认按来源混排，不被 MotionSites 占满首屏', () => {
  const rows = [
    ...Array.from({ length: 8 }, (_, index) => ({ name: `Motion ${index}`, sourceShort: 'MotionSites' })),
    ...Array.from({ length: 2 }, (_, index) => ({ name: `Framer ${index}`, sourceShort: 'Framer' })),
    ...Array.from({ length: 3 }, (_, index) => ({ name: `21st ${index}`, sourceShort: '21st.dev' })),
  ];
  const mixed = mixPageSources(rows);
  assert.deepEqual(mixed.slice(0, 3).map(pageSource), ['21st.dev', 'Framer', 'MotionSites']);
  assert.equal(new Set(mixed.slice(0, 6).map(pageSource)).size, 3);
  assert.equal(mixed.length, rows.length);
});
