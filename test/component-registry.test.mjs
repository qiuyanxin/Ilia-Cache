import test from 'node:test';
import assert from 'node:assert/strict';
import { installCommandFromInput, normaliseRegistryItem, registryUrlFromInput } from '../component-registry.mjs';

test('从 shadcn 命令识别 Registry 地址和 Kokonut 简写', () => {
  assert.equal(
    registryUrlFromInput('npx shadcn@latest add https\\://kokonutui.com/r/smooth-tab.json\u00a0'),
    'https://kokonutui.com/r/smooth-tab.json',
  );
  assert.equal(
    registryUrlFromInput('npx shadcn@latest add @kokonutui/smooth-tab'),
    'https://kokonutui.com/r/smooth-tab.json',
  );
});

test('从整段 Agent 文案中只保留可执行的安装命令', () => {
  assert.equal(installCommandFromInput('Add it with npx shadcn@latest add https://kokonutui.com/r/file-upload.json, then show usage.', 'https://kokonutui.com/r/file-upload.json'),
    'npx shadcn@latest add https://kokonutui.com/r/file-upload.json');
});

test('Registry 保留源码文件、依赖、许可和作者', () => {
  const item = normaliseRegistryItem({
    name: 'smooth-tab',
    type: 'registry:component',
    dependencies: ['motion', 'lucide-react', 'motion'],
    files: [{
      path: '/components/kokonutui/smooth-tab.tsx',
      content: '/** @author: @dorianbaffier\n * @license: MIT */\nexport default function SmoothTab(){ return <div /> }',
    }],
  }, 'https://kokonutui.com/r/smooth-tab.json', 'npx shadcn add @kokonutui/smooth-tab');
  assert.deepEqual(item.files.map(file => file.name), ['components/kokonutui/smooth-tab.tsx']);
  assert.deepEqual(item.dependencies, ['motion', 'lucide-react']);
  assert.equal(item.framework, 'react');
  assert.equal(item.license, 'MIT');
  assert.equal(item.author, '@dorianbaffier');
});
