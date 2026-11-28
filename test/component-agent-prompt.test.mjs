import assert from 'node:assert/strict';
import test from 'node:test';
import { portableComponentPrompt } from '../public/component-agent-prompt.mjs';

test('安装命令生成可带走使用且不依赖本机资料库的 Agent 提示词', () => {
  const prompt = portableComponentPrompt({
    name: 'Smooth Tab', installCommand: 'npx shadcn@latest add https://example.com/smooth-tab.json',
    license: 'MIT', primarySourceAuthor: '@author',
  }, { sourceUrl: 'https://example.com/smooth-tab', category: '导航与菜单' });
  assert.match(prompt, /npx shadcn@latest add/);
  assert.match(prompt, /原始来源：https:\/\/example\.com\/smooth-tab/);
  assert.match(prompt, /交付可以直接运行的结果/);
  assert.doesNotMatch(prompt, /Ilia|MCP|查找 ID|收藏的组件/);
});

test('源码组件把文件带进 Agent 提示词，未附源码时明确回到原始来源', () => {
  const withCode = portableComponentPrompt({ name: 'Dynamic Text', license: 'MIT' }, {
    sourceUrl: 'https://example.com/dynamic-text', files: [{ name: 'Preview.tsx', content: 'export default function Preview(){}' }],
  });
  assert.match(withCode, /--- Preview\.tsx ---/);
  assert.match(withCode, /export default function Preview/);
  const sourceOnly = portableComponentPrompt({ name: 'Accordion Gallery' }, { sourceUrl: 'https://example.com/accordion' });
  assert.match(sourceOnly, /从上面的原始来源获取官方提供的源码或安装方式/);
  assert.match(sourceOnly, /不要根据截图伪造源码/);
});
