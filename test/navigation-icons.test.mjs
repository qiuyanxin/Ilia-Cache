import test from 'node:test';
import assert from 'node:assert/strict';
import { icon, NAV_ICONS } from '../public/icons.mjs';

test('侧栏每个入口使用不同的 Streamline Flex Line 图标', () => {
  const names = Object.values(NAV_ICONS);
  assert.equal(names.length, 12);
  assert.equal(new Set(names).size, names.length);
  assert.equal(new Set(names.map(icon)).size, names.length);
  assert.ok(names.every((name) => icon(name) !== icon('missing-icon')));
  assert.ok(names.every((name) => icon(name).includes('streamline-line')));
});
