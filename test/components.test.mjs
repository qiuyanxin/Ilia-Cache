import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseMedia} from '../media.mjs';
import {zipFiles} from '../library-store.mjs';
import {canDistributeSource,componentCategory,isComponent,sourcePage} from '../public/extensions.js';
test('LeiBox分享Logo不能盖过实际组件素材，原站favicon可保留',()=>{const r=parseMedia('<meta property="og:image" content="/leibox-og.png"><link rel="icon" href="/favicon.svg"><img src="/assets/image-compare.webp">','https://leibox.pantoria.cn/docs/animations/image-compare');assert.deepEqual(r.media.map(m=>m.url),['https://leibox.pantoria.cn/assets/image-compare.webp']);assert.equal(r.icon,'https://leibox.pantoria.cn/favicon.svg');});
test('已有组件按作用分类，已移除组件不进入索引',()=>{assert.equal(componentCategory({url:'https://example.com/image-compare'}),'图集与轮播');assert.equal(componentCategory({url:'https://example.com/pull-cord'}),'按钮与输入');assert.equal(isComponent({archived:true,caseType:'组件'}),false);});
test('适配的卡组保留原弹簧和拖动阈值，拉绳取消自动换肤',async()=>{const deck=await readFile(new URL('../public/motion/swipe-deck.html',import.meta.url),'utf8'),cord=await readFile(new URL('../public/motion/pull-cord.html',import.meta.url),'utf8');assert.match(deck,/--deck-drag:900 50/);assert.match(deck,/--deck-return:280 16/);assert.match(deck,/--deck-threshold:110/);assert.match(cord,/S\(0, 46, 3\)/);assert.match(cord,/S\(1, 300, 17\)/);assert.doesNotMatch(cord,/function auto\(/);});
test('ZIP包含UTF-8文件名和完整源码字节',()=>{const zip=zipFiles([{name:'组件.html',content:'<h1>你好</h1>'},{name:'PROMPT.md',content:'原文'}]);assert.equal(zip.readUInt32LE(0),0x04034b50);assert.ok(zip.includes(Buffer.from('组件.html')));assert.ok(zip.includes(Buffer.from('<h1>你好</h1>')));assert.equal(zip.readUInt16LE(zip.length-12),2);});
test('Motion Prompt 240条都保留中文名、预览、提示词和源码包',async()=>{const rows=JSON.parse(await readFile(new URL('../public/seed.json',import.meta.url))).filter(item=>item.id?.startsWith('motion-prompt-'));assert.equal(rows.length,240);assert.ok(rows.every(item=>item.name&&item.originalName&&item.externalPreview&&item.prompt&&item.filePackage&&item.license==='MIT'));await Promise.all(rows.map(item=>readFile(new URL(`../public/component-packages/${item.filePackage}.json`,import.meta.url))));});
test('公开仓库871个组件都有作者、来源和直达组件页',async()=>{const all=JSON.parse(await readFile(new URL('../public/seed.json',import.meta.url))),rows=all.filter(item=>item.caseType==='组件'||item.componentCategory||item.builtin);assert.equal(rows.length,871);assert.ok(rows.every(item=>item.primarySourceAuthor&&item.sourceShort&&item.sourcePolicy&&item.sourcePageUrl));for(const item of rows){const url=new URL(item.sourcePageUrl);assert.ok(['http:','https:'].includes(url.protocol));assert.ok(url.pathname!=='/'||url.search||url.hash,`${item.id} 只指向了来源首页`);}assert.equal(rows.filter(item=>item.sourcePolicy==='bundled-source').length,260);assert.ok(rows.filter(item=>item.sourcePolicy!=='bundled-source').every(item=>!item.filePackage));});
test('React Bits 只从官方页获取源码，MCP 不转发完整文件',()=>{const item={url:'https://reactbits.dev/animations/click-spark',sourcePageUrl:'https://reactbits.dev/animations/click-spark',sourcePolicy:'official-source-only'};assert.equal(sourcePage(item),item.sourcePageUrl);assert.equal(canDistributeSource(item),false);assert.equal(canDistributeSource({sourcePolicy:'bundled-source'}),true);});

test('光谱卡包属于卡片，来源显示为原创', async () => {
  const seed = JSON.parse(await readFile(new URL('../public/seed.json', import.meta.url)));
  const row = seed.find(item => item.id === 'ilia-holo-pack');
  assert.equal(row.componentCategory, '卡片');
  assert.equal(row.sourceShort, '原创');
  assert.equal(row.primarySourceAuthor, 'Ilia');
  assert.deepEqual(row.tags, ['卡片', '拖拽', '拆包动效']);
  assert.match(await readFile(new URL('../public' + row.thumbnailFrame, import.meta.url), 'utf8'), /拆开光谱卡包/);
});
