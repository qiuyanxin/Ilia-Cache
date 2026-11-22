import test from 'node:test';
import assert from 'node:assert/strict';
import { componentLoadRank, componentMedia } from '../public/component-media.mjs';

test('组件预览先排轻资源，视频和 iframe 延迟设置 src', () => {
  assert.ok(componentLoadRank({ localPoster: '/poster.webp' }) < componentLoadRank({ previewVideo: 'https://example.com/demo.mp4' }));
  assert.ok(componentLoadRank({ builtin: 'pull-cord' }) < componentLoadRank({}));
  const video = componentMedia({ name: '视频', previewVideo: 'https://example.com/demo.mp4' }, () => '');
  const frame = componentMedia({ name: '页面', thumbnailFrame: '/preview.html' }, () => '');
  assert.match(video, /data-src="https:\/\/example\.com\/demo\.mp4"/);
  assert.doesNotMatch(video, /\ssrc=/);
  assert.match(frame, /data-src="\/preview\.html"/);
  assert.doesNotMatch(frame, /\ssrc=/);
});

test('Motion Prompt 每张卡片按组件编号显示预览', () => {
  for (const id of ['153', '218']) {
    const html = componentMedia({
      id: `motion-prompt-${id}`,
      name: 'Motion Prompt',
      localPoster: '/motion-prompt/assets/preview-motion.gif',
    }, () => '');
    assert.match(html, /class="motion-prompt-thumb"/);
    assert.ok(html.includes(`data-src="/motion-prompt/thumbnail.html#${id}"`));
    assert.doesNotMatch(html, /preview-motion\.gif/);
  }
});
