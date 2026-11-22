import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPONENT_BROWSE_GROUPS, COMPONENT_CATEGORY_GROUPS, componentBrowseCategory, componentCategory } from '../public/component-categories.mjs';
import { renderComponentPreview } from '../component-packages.mjs';

test('the component library groups switches, button effects and loaders', () => {
  assert.deepEqual(COMPONENT_CATEGORY_GROUPS['开关与主题'], ['基础开关', '拟态开关', '主题切换', '主题设置']);
  assert.deepEqual(COMPONENT_CATEGORY_GROUPS['按钮效果'], ['玻璃按钮', '流体按钮', '复古按钮']);
  assert.ok(COMPONENT_CATEGORY_GROUPS['界面交互'].includes('加载动画'));
  for (const componentCategoryName of ['主题切换', '主题设置', '玻璃按钮', '流体按钮', '复古按钮', '加载动画']) {
    assert.equal(componentCategory({ componentCategory: componentCategoryName }), componentCategoryName);
  }
});

test('local interaction previews only accept imported interaction package IDs', async () => {
  assert.equal(await renderComponentPreview('../asset'), '');
  assert.equal(await renderComponentPreview('motion-prompt-059'), '');
});

test('横版浏览按用途细分，保留已有的明确分类', () => {
  assert.deepEqual(Object.keys(COMPONENT_BROWSE_GROUPS).slice(0, 7), ['图片', '文字', '按钮', '卡片', '播放器', '开关', '表单']);
  const examples = [
    ['手风琴相册', '图片、图集与轮播', '图集与相册'],
    ['专辑封面隧道', '图片、图集与轮播', '图集与相册'],
    ['玻璃播放器', '卡片与列表', '音乐播放器'],
    ['蜘蛛牵引切歌', '图集与轮播', '音乐播放器'],
    ['拖动进度', '按钮与表单', '播放控制与进度条'],
    ['弹性图片对比', '图片、图集与轮播', '图片对比'],
    ['滚动堆叠卡片', '图片、图集与轮播', '堆叠与切换'],
    ['模糊文字入场', '文字与排版', '文字入场'],
    ['立体按压按钮', '按钮与表单', '悬停与按压'],
    ['像素日夜开关', '按钮与表单', '主题切换'],
    ['光泽材质实验', '玻璃按钮', '玻璃按钮'],
    ['玻璃播放器', '视频播放器', '视频播放器'],
  ];
  for (const [name, componentCategory, expected] of examples) {
    assert.equal(componentBrowseCategory({ name, componentCategory }), expected, name);
  }
});
