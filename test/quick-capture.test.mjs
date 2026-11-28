import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('统一添加入口可接收网址、命令、代码、文字和文件', async () => {
  const source = await readFile(new URL('../public/collection-pages.mjs', import.meta.url), 'utf8');
  assert.match(source, /class="quick-capture"/);
  assert.match(source, /添加到资料库/);
  assert.match(source, /网址、组件命令、代码、文字或文件都可以/);
  assert.match(source, /识别为：/);
  assert.doesNotMatch(source, /帮你整理到工作台/);
  assert.doesNotMatch(source, /也可以直接拖入图片、视频或文件/);
  assert.doesNotMatch(source, /内容会进入工作台的收件箱/);
  assert.doesNotMatch(source, /\.map\(entryMarkup\)/);
  assert.match(source, /class="inbox-edit-trigger" data-open-entry=/);
  assert.match(source, /function animateEntryOpen\(opener\)/);
  assert.match(source, /inboxDone:Boolean\(preset\.aesthetic\|\|preset\.styleId\)/);
});

test('收件箱卡片使用组件库卡片缩放参数并尊重减少动态效果', async () => {
  const css = await readFile(new URL('../public/interface.css', import.meta.url), 'utf8');
  assert.match(css, /--resize-dur:300ms/);
  assert.match(css, /--resize-ease:cubic-bezier\(\.22,1,\.36,1\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});
