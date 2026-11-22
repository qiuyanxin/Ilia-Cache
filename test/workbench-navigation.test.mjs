import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('审美、项目、灵感和收藏共用一个工作台导航入口', async () => {
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const favorites = await readFile(new URL('../public/favorites.mjs', import.meta.url), 'utf8');
  const nav = app.match(/const NAV=\[(.*?)\];/s)?.[1] || '';
  assert.equal((nav.match(/'工作台'/g) || []).length, 1);
  assert.equal(nav.includes("'审美积累'"), false);
  assert.equal(nav.includes("'项目夹'"), false);
  assert.equal(nav.includes("'学习积累'"), false);
  assert.equal(nav.includes("'我的收藏'"), false);
  assert.match(app, /ACCUMULATION_VIEWS=new Set\(\['inbox','aesthetic','projects','accumulation','learn','favorites'\]\)/);
  assert.match(app, /\['inbox','◩','工作台'\]/);
  assert.match(favorites, /<h1>工作台<\/h1>/);
  assert.match(favorites, /data-accumulation-view="favorites" class="active">收藏<\/button>/);
});
