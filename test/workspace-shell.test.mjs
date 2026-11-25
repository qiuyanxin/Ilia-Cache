import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { inspectWorkspaceChrome, inspectWorkspaceShell, renderWorkspaceShell } from '../lib/workspace-shell.mjs';
import { icon } from '../public/icons.mjs';

const source = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

test('开源入口原生运行，解析后的默认模板保留原页面内容和资源', () => {
  assert.deepEqual(inspectWorkspaceShell(source), {
    styles: ['/style.css', '/theme.css', '/extensions.css', '/glass-folders.css', '/interface.css', '/component-workspace.css'],
    entry: '/app.js?v=20261122b',
  });
  const unmarked = source
    .replaceAll(/<!--ilia-shell:[\w:]+-->/g, '')
    .replaceAll(/ data-ilia-shell-attrs="(?:root|library)"/g, '');
  assert.equal(renderWorkspaceShell(source), unmarked);
});

test('直达详情的初始记录保留原始文本并在 HTML 中作为数据读取', () => {
  const detailBootstrap = { count: 850, record: { id: 'demo', prompt: 'HTML 示例包含 <button> 与 </script> 文本。' } };
  const output = renderWorkspaceShell(source, { entry: '/ilia-ui/runtime.mjs', detailBootstrap });
  const data = output.match(/<script id="ilia-detail-data" type="application\/json">([^<]*)<\/script>/u);
  assert.ok(data);
  assert.deepEqual(JSON.parse(data[1]), detailBootstrap);
  assert.ok(output.indexOf('id="ilia-detail-data"') < output.indexOf('src="/ilia-ui/runtime.mjs"'));
});

test('宿主配置生成资源地址、路由头和可直接读取的组件来源', () => {
  const output = renderWorkspaceShell(source, {
    assetPrefix: '/ilia-ui/',
    extraStyles: ['/ilia-ui/readonly.css?color=dark&size=wide'],
    rootAttributes: { 'data-ilia-site': true, 'data-label': '"<分组>"', 'data-inactive': false },
    libraryHidden: true,
    entry: '/ilia-ui/runtime.mjs',
    head: {
      title: '按钮 <组件>',
      description: '查看原作者与演示',
      canonical: 'https://example.com/components/button?demo=1&source=original',
      meta: [{ name: 'robots', content: 'index,follow' }, { property: 'og:type', content: 'website' }],
    },
    fallback: {
      id: 'ilia-ssr',
      title: '按钮',
      description: '无需脚本也能访问来源',
      image: { src: '/posters/button.webp', alt: '按钮 "原图"' },
      links: [
        { href: 'https://example.org/buttons?demo=1&theme=dark', label: '查看来源', external: true },
        { href: '/', label: '组件库' },
      ],
    },
  });
  assert.match(output, /<html lang="zh-CN" data-theme="dark" data-ilia-site data-label="&quot;&lt;分组&gt;&quot;">/);
  assert.match(output, /<main id="library" hidden>/);
  assert.match(output, /<title>按钮 &lt;组件&gt;<\/title>/);
  assert.match(output, /rel="canonical" href="https:\/\/example\.com\/components\/button\?demo=1&amp;source=original"/);
  assert.match(output, /<meta name="robots" content="index,follow">/);
  assert.match(output, /<meta property="og:type" content="website">/);
  assert.match(output, /href="\/ilia-ui\/style.css"/);
  assert.match(output, /href="\/ilia-ui\/readonly.css\?color=dark&amp;size=wide"/);
  assert.match(output, /<script src="\/ilia-ui\/runtime\.mjs" type="module"><\/script>/);
  assert.match(output, /<main class="workspace-fallback" id="ilia-ssr"><h1>按钮<\/h1>/);
  assert.match(output, /alt="按钮 &quot;原图&quot;"/);
  assert.match(output, /href="https:\/\/example\.org\/buttons\?demo=1&amp;theme=dark" target="_blank" rel="noopener noreferrer">查看来源<\/a>/);
  assert.match(output, /href="\/">组件库<\/a>/);
  assert.doesNotMatch(output, /app\.js\?v=|data-inactive|ilia-shell:/);
});

test('服务端目录筛选表单保留有效值，对关键词和选项进行 HTML 转义', () => {
  const filters = {
    action: '/zh', query: '"><em>demo</em>', category: '卡片', source: 'A&B',
    categories: ['卡片', '文字'], sources: ['A&B', '<作者>'],
    categoryCounts: { '': 7, '卡片': 2 },
  };
  const fallback = { title: '组件库', filters };
  const output = renderWorkspaceShell(source, { libraryHidden: true, fallback });
  assert.match(output, /method="get" action="\/zh"/);
  assert.match(output, /name="q" value="&quot;&gt;&lt;em&gt;demo&lt;\/em&gt;"/);
  assert.match(output, /name="category" value="卡片" form="ilia-directory-filters" aria-label="卡片" checked>卡片<small>2<\/small>/);
  assert.match(output, /name="source" value="A&amp;B" form="ilia-directory-filters" aria-label="A&amp;B" checked>A&amp;B/);
  assert.match(output, /name="source" value="&lt;作者&gt;" form="ilia-directory-filters" aria-label="&lt;作者&gt;">&lt;作者&gt;/);
  assert.throws(() => renderWorkspaceShell(source, {
    fallback: { ...fallback, filters: { ...filters, action: '//example.com/' } },
  }), TypeError);
});

test('服务端目录卡片只接受站内详情地址、安全海报和有效分列位置', () => {
  const card = {
    id: 'demo', href: '/zh/components/demo?q=a&source=b', title: '<标题>',
    description: '按钮 & 卡片', category: '按钮与输入', source: '原始来源', sourceHref: 'https://example.org/demo',
    poster: '/posters/demo.webp', slots: { 1: { column: 1, row: 2 }, 3: { column: 2, row: 1 } },
  };
  const render = item => renderWorkspaceShell(source, { fallback: { title: '组件库', cards: [item] } });
  const output = render(card);
  assert.match(output, /data-component-id="demo" data-lanes="1 3"/);
  assert.match(output, /aria-label="预览 &lt;标题&gt;" href="\/zh\/components\/demo\?q=a&amp;source=b"/);
  assert.match(output, /<h3><a class="component-title-control"[^>]*href="\/zh\/components\/demo\?q=a&amp;source=b">&lt;标题&gt;<\/a><\/h3>/);
  assert.match(output, /src="\/posters\/demo\.webp" alt="&lt;标题&gt;" loading="lazy"/);
  assert.match(output, /class="component-source-name" href="https:\/\/example\.org\/demo" target="_blank" rel="noopener noreferrer"/);
  assert.match(output, /按钮 &amp; 卡片/);
  for (const item of [
    { ...card, href: 'https://example.org/demo' },
    { ...card, poster: 'javascript:alert(1)' },
    { ...card, sourceHref: 'javascript:alert(1)' },
    { ...card, slots: { 1: { column: 3, row: 1 } } },
    { ...card, slots: {} },
  ]) assert.throws(() => render(item), TypeError);
});

test('服务端目录为有筛选的结果和空态提供同一个清除操作', () => {
  const filters = { action: '/zh', query: 'demo', category: '', source: '', categories: [], sources: [] };
  const render = (count, query = filters.query) => renderWorkspaceShell(source, {
    fallback: { title: '组件库', filters: { ...filters, query }, cards: [], directoryResultCount: count },
  });
  const reset = /<a class="component-directory-reset" data-clear-directory href="\/zh">清除筛选<\/a>/;
  const empty = render(0);
  assert.match(empty, /data-directory-status="empty">\s*<p role="status">找不到符合条件的组件。<\/p>/);
  assert.match(empty, reset);
  const filtered = render(1);
  assert.match(filtered, /data-directory-status="filtered">\s*<p role="status">找到 1 个组件。<\/p>/);
  assert.match(filtered, reset);
  assert.match(render(0, ''), /这里还没有组件。<\/p><a[^>]*data-clear-directory hidden/);
  assert.match(render(850, ''), /data-directory-status="all" hidden/);
  assert.throws(() => render(-1), TypeError);
});

test('服务端详情保留静态预览、来源和带筛选的目录返回链接', () => {
  const detail = {
    category: '动效与镜头', back: '/zh?q=demo&source=Motion+Prompt',
    source: { href: 'https://example.org/motion/#001', label: '打开组件来源 ↗' },
    preview: { kind: 'motion', poster: '/posters/demo.webp', ratio: 2.5 },
  };
  const render = input => renderWorkspaceShell(source, {
    fallback: { id: 'ilia-ssr', title: '动效 <预览>', description: '带空格的说明 ', detail: input },
  });
  const output = render(detail);
  assert.match(output, /<h1 id="ilia-ssr-title">动效 &lt;预览&gt;<\/h1>/);
  assert.match(output, /href="\/zh\?q=demo&amp;source=Motion\+Prompt" aria-label="返回组件库"/);
  assert.match(output, /href="https:\/\/example\.org\/motion\/#001" target="_blank" rel="noopener noreferrer"/);
  assert.match(output, /--canvas-ratio:2\.5/);
  assert.match(output, /src="\/posters\/demo\.webp"/);
  assert.doesNotMatch(output, /<iframe/);
  const prompt = render({ ...detail, panel: { kind: 'prompt', prompt: '\n原文 </textarea> & 参考' } });
  assert.match(prompt, /class="component-prompt">\s*<label>提示词原文<textarea class="command-field" data-detail-prompt rows="14" readonly/);
  assert.match(prompt, />\n\n原文 &lt;\/textarea&gt; &amp; 参考<\/textarea>/);
  assert.doesNotMatch(prompt, /id="copy-component-prompt"/);
  assert.throws(() => render({ ...detail, preview: { ...detail.preview, ratio: '2; color:red' } }), TypeError);
  assert.throws(() => render({ ...detail, back: '//example.org/' }), TypeError);
});

test('专题宿主直接复用本机主题脚本、侧栏和顶栏标记', () => {
  const fragments = inspectWorkspaceChrome(source);
  assert.match(fragments.theme, /<script>[\s\S]*ilia-design-theme[\s\S]*<\/script>/);
  assert.match(fragments.sidebar, /^<aside class="sidebar">.*id="navigation".*<\/aside>$/);
  assert.match(fragments.topbar, /^<header class="topbar">.*id="theme-controls".*<\/header>$/);
  const rendered = renderWorkspaceShell(source);
  for (const fragment of Object.values(fragments)) assert.ok(rendered.includes(fragment));
});

test('公开工作台首屏使用真实站内导航并移除本机专用操作', () => {
  const chrome = {
    home: '/zh', search: '/zh?q=demo&source=local#ilia-search', breadcrumb: '组件库', renderIcon: icon,
    items: [{ id: 'components', href: '/zh', label: '组件 <目录>', icon: 'grid', active: true, count: 850 }],
  };
  const output = renderWorkspaceShell(source, { chrome });
  assert.match(output, /class="brand" href="\/zh"/);
  assert.match(output, /data-view="components" href="\/zh" aria-label="组件 &lt;目录&gt;" aria-current="page"/);
  assert.match(output, /data-dock="search" href="\/zh\?q=demo&amp;source=local#ilia-search"/);
  assert.match(output, /<small>850<\/small>/);
  assert.doesNotMatch(output, /id="(?:export|import|learn-top|add)"|>LOCAL</);
  assert.throws(() => renderWorkspaceShell(source, { chrome: { ...chrome, home: '//example.org/' } }), TypeError);
});

test('入口明确为空时保留服务端回退信息，无脚本资源可加载', () => {
  const output = renderWorkspaceShell(source, {
    entry: null,
    head: { title: '未找到组件', meta: [{ name: 'robots', content: 'noindex' }] },
    fallback: { title: '未找到组件', links: [{ href: '/', label: '返回组件库' }] },
  });
  assert.match(output, /<h1>未找到组件<\/h1>/);
  assert.match(output, /<a href="\/">返回组件库<\/a>/);
  assert.doesNotMatch(output, /<script[^>]+\bsrc=/);
});

test('改动标签的空白、引号和属性顺序仍可绑定到同一语义插槽', () => {
  const rearranged = source
    .replace(' id="library" data-ilia-shell-attrs="library"', "\n data-ilia-shell-attrs='library' id='library'")
    .replace('<link rel="stylesheet" href="/style.css">', "<link href = '/style.css' media='all' rel='stylesheet'>");
  const output = renderWorkspaceShell(rearranged, { assetPrefix: '/custom', libraryHidden: true });
  assert.match(output, /<main hidden id='library'>/);
  assert.match(output, /<link href="\/custom\/style.css" media='all' rel='stylesheet'>/);
});

test('缺失、重复、顺序错误或格式错误的插槽会阻断构建', () => {
  for (const invalid of [
    source.replace('<!--ilia-shell:head:start-->', ''),
    source + '<!--ilia-shell:head:start-->',
    source.replace('<!--ilia-shell:entry:start-->', '<!--ilia-shell:entry:end-->'),
    source.replace('data-ilia-shell-attrs="library"', 'data-ilia-shell-attrs=library'),
    source.replace(' id="library" ', ' id="library" data-ilia-shell-attrs="library" '),
    source.replace('href="/theme.css"', 'href="/style.css"'),
    source.replace('<head>', ''),
    source.replace('rel="stylesheet" href="/style.css"', 'rel="icon" href="/style.css"'),
  ]) {
    assert.throws(() => inspectWorkspaceShell(invalid), /工作台模板插槽无效/);
  }
});

test('拒绝非普通选项、未知字段与不安全链接', () => {
  for (const options of [
    new Map(),
    { head: { title: '目录', html: '<script></script>' } },
    { head: { title: '目录', canonical: 'javascript:alert(1)' } },
    { rootAttributes: { onclick: 'alert(1)' } },
    { rootAttributes: { 'data-theme': 'light' } },
    { extraStyles: ['//example.org/style.css'] },
    { assetPrefix: '/public/../temp' },
    { assetPrefix: '/public?x=' },
    { libraryHidden: 'true' },
    { entry: 'https://example.org/runtime.js' },
    { fallback: { title: '组件', links: [{ href: 'javascript:alert(1)', label: '来源' }] } },
  ]) {
    assert.throws(() => renderWorkspaceShell(source, options), TypeError);
  }
});
