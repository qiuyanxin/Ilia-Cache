import test from 'node:test';
import assert from 'node:assert/strict';
import { generatedPreview, inferComponentDetails, registryDisplayName, sourceMetadataFromFiles } from '../public/local-component-editor.mjs';
import { componentArchiveManifest, componentArchivePrompt, componentArchiveReadme } from '../public/local-component-actions.mjs';
import { registryAgentPrompt } from '../public/registry-component.mjs';

test('Registry 名称优先使用组件条目而不是源码里的内部函数', () => {
  assert.equal(registryDisplayName('smooth-tab'), 'Smooth Tab');
});

test('Registry 目录卡片延迟加载生成预览并提供 Agent 安装提示词', () => {
  const record = { captureMethod: 'registry', name: 'Smooth Tab', installCommand: 'npx shadcn@latest add @kokonutui/smooth-tab', preview: { kind: 'html', url: '/api/component-previews/' + 'a'.repeat(64) } };
  const card = generatedPreview(record, { card: true });
  assert.match(card, /data-src="\/api\/component-previews\/[a-f0-9]{64}"/);
  assert.doesNotMatch(card, /\ssrc=/);
  const prompt = registryAgentPrompt(record, 'https://kokonutui.com/docs/navigation/smooth-tab');
  assert.match(prompt, /npx shadcn@latest add @kokonutui\/smooth-tab/);
  assert.match(prompt, /原组件页：https:\/\/kokonutui\.com\/docs\/navigation\/smooth-tab/);
});

test('链接组件自动采用网页标题并识别分类', () => {
  assert.deepEqual(inferComponentDetails({
    url: 'https://example.com/components/image-compare',
    metadata: { title: 'Image Compare | Example UI' },
  }), {
    name: 'Image Compare',
    framework: undefined,
    category: '图片对比',
  });
});

test('React 代码自动识别组件名称和格式', () => {
  assert.deepEqual(inferComponentDetails({
    files: [{ name: 'Preview.tsx', content: 'export default function GlowButton(){ return <button>Save</button> }' }],
  }), {
    name: 'Glow Button',
    framework: 'react',
    category: '基础按钮',
  });
});

test('HTML 文件名可作为缺省名称且手填内容优先', () => {
  assert.deepEqual(inferComponentDetails({
    name: '我的菜单',
    files: [{ name: 'floating-menu.html', content: '<nav>Menu</nav>' }],
  }), {
    name: '我的菜单',
    framework: 'html',
    category: '导航与菜单',
  });
});

test('粘贴源码会识别注释中的名称、作者、许可、网站和依赖', () => {
  assert.deepEqual(sourceMetadataFromFiles([{ name: 'Preview.tsx', content: `/**
 * @author: @dorianbaffier
 * @description: Account Menu
 * @license: MIT
 * @website: https://kokonutui.com
 */
import { User } from "lucide-react"
import { motion } from "motion/react"
import React from "react"
import { cn } from "@/lib/utils"` }]), {
    title: 'Account Menu',
    author: '@dorianbaffier',
    license: 'MIT',
    website: 'https://kokonutui.com',
    dependencies: ['lucide-react', 'motion'],
  });
});

test('ZIP 包含可执行说明、来源元数据和源码清单', () => {
  const record = {
    id: 'local-account-menu', name: 'Account Menu', componentCategory: '导航与菜单', framework: 'react',
    primarySourceAuthor: '@dorianbaffier', license: 'MIT', sourcePageUrl: 'https://kokonutui.com/docs/navigation/account-menu',
    dependencies: ['lucide-react', 'motion'],
  };
  const files = [{ name: 'Preview.tsx', content: 'export default function Preview(){}' }];
  assert.deepEqual(componentArchiveManifest(record, files).sourceFiles, ['Preview.tsx']);
  assert.match(componentArchiveReadme(record, files), /作者：@dorianbaffier/);
  assert.match(componentArchiveReadme(record, files), /依赖：lucide-react、motion/);
  assert.match(componentArchivePrompt(record), /请在当前项目中集成「Account Menu」组件/);
  assert.doesNotMatch(componentArchivePrompt(record), /尚无提示词/);
});
