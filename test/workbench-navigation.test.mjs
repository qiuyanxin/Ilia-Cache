import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('项目、采集和收藏共用一个工作台导航入口', async () => {
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const collections = await readFile(new URL('../public/collection-pages.mjs', import.meta.url), 'utf8');
  const favorites = await readFile(new URL('../public/favorites.mjs', import.meta.url), 'utf8');
  const interfaceSource = await readFile(new URL('../public/interface.mjs', import.meta.url), 'utf8');
  const interfaceStyles = await readFile(new URL('../public/interface.css', import.meta.url), 'utf8');
  const nav = app.match(/const NAV=\[(.*?)\];/s)?.[1] || '';
  assert.equal((nav.match(/'工作台'/g) || []).length, 1);
  assert.equal(nav.includes("'审美积累'"), false);
  assert.equal(nav.includes("'项目夹'"), false);
  assert.equal(nav.includes("'学习积累'"), false);
  assert.equal(nav.includes("'我的收藏'"), false);
  assert.match(app, /WORKBENCH_VIEWS=new Set\(\['projects','capture','favorites','learn'\]\)/);
  assert.match(app, /\['projects','◩','工作台'\]/);
  assert.match(app, /capture:'capture'/);
  assert.match(favorites, /<h1>工作台<\/h1>/);
  assert.match(favorites, /data-favorite-project/);
  assert.match(interfaceSource, /label: "收藏"/);
  assert.match(interfaceSource, /label: "工作台"/);
  assert.doesNotMatch(interfaceSource, /label: "学习"|label: "组件库"/);
  for (const source of [collections, favorites]) {
    assert.doesNotMatch(source, />收件箱<|>审美采集<|>灵感库</);
  }
  assert.match(collections, /id="entry-original" rows="3" aria-label="备注与提示词"/);
  assert.match(collections, /<span>内容类型<\/span><select id="entry-category" aria-label="内容类型">/);
  assert.match(collections, /<span>保存位置<\/span><select id="entry-collection" aria-label="保存位置">/);
  assert.match(collections, /Math\.min\(original\.scrollHeight,180\)/);
  assert.doesNotMatch(collections, /id="entry-learn"|>学习<\/button>/);
  assert.match(collections, /aesthetic\?media:media\.slice\(0,1\)/);
  assert.match(collections, /data-project-entry="\$\{esc\(r\.id\)\}" aria-label="加入项目/);
  assert.match(collections, /type:captureType\(entry\)/);
  assert.match(interfaceStyles, /aspect-ratio: 16 \/ 9/);
  assert.match(interfaceStyles, /#collection-detail:has\(#entry-original\) \.detail-assets/);
  assert.match(interfaceStyles, /max-height: min\(30vh, 280px\)/);
});
