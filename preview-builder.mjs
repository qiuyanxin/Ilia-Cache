import { readFile } from 'node:fs/promises';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const dependencies = new Set([
  'react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/client',
  'motion', 'motion/react', 'lucide-react', 'clsx', 'tailwind-merge', 'class-variance-authority',
]);
const loaders = { html: 'text', js: 'jsx', mjs: 'jsx', cjs: 'jsx', jsx: 'jsx', ts: 'ts', tsx: 'tsx', css: 'css', json: 'json' };
const workDir = fileURLToPath(new URL('.', import.meta.url));
const runtime = `import React from 'react';
import { createRoot } from 'react-dom/client';
import * as source from '$ilia/component';
class PreviewBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    return this.state.error
      ? React.createElement('p', { role: 'alert' }, '组件运行失败，请检查演示参数：' + this.state.error.message)
      : this.props.children;
  }
}
const exported = Object.keys(source).filter(key => /^[A-Z]/.test(key) && typeof source[key] === 'function');
const Component = source.default || (exported.length === 1 ? source[exported[0]] : null);
const root = createRoot(document.getElementById('preview'));
root.render(React.createElement(PreviewBoundary, null, Component
  ? React.createElement(Component, {})
  : React.createElement('p', { role: 'status' }, '请使用 default export，指定用来预览的 React 组件。')));
`;
const builtinUtils = `import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...input) { return twMerge(clsx(input)); }
`;

const ready = srcdoc => ({ status: 'ready', preview: { kind: 'html', srcdoc } });
const needsInput = message => ({ status: 'needs-input', message });
const inlineScript = content => content.replace(/<\/script/gi, '<\\/script');
const inlineStyle = content => content.replace(/<\/style/gi, '<\\/style');
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))?.slice(1).find(value => value !== undefined);
const hasOwn = (object, name) => Object.hasOwn(object, name);

function buildHtml(files, entry) {
  const missing = new Set();
  const resolve = value => {
    if (!value || /^(?:[#/?]|[a-z][a-z0-9+.-]*:)/i.test(value)) return null;
    return files.get(posix.normalize(posix.join(posix.dirname(entry), value.split(/[?#]/)[0])));
  };
  const html = files.get(entry)
    .replace(/<link\b[^>]*>/gi, tag => {
      if (!/^stylesheet$/i.test(attr(tag, 'rel') || '')) return tag;
      const value = attr(tag, 'href');
      const css = resolve(value);
      if (css === undefined || css === null) { missing.add(value || 'CSS'); return tag; }
      return `<style>${inlineStyle(css)}</style>`;
    })
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, block => {
      const tag = block.match(/^<script\b[^>]*>/i)[0];
      const value = attr(tag, 'src');
      if (!value) return block;
      const js = resolve(value);
      if (js === undefined || js === null) { missing.add(value); return block; }
      const type = attr(tag, 'type') === 'module' ? ' type="module"' : '';
      return `<script${type}>${inlineScript(js)}</script>`;
    });
  if (missing.size) return needsInput(`请补充 HTML 引用的本地文件：${[...missing].slice(0, 5).join('、')}。预览不加载外部脚本和样式。`);
  return ready(html);
}

function virtualFiles(files, entry) {
  const matchFile = base => ['', '.tsx', '.ts', '.jsx', '.js', '.css', '.json', '/index.tsx', '/index.ts', '/index.jsx', '/index.js']
    .map(ext => base + ext).find(name => files.has(name));
  return {
    name: 'ilia-preview-files',
    setup(build) {
      build.onResolve({ filter: /^\$ilia\/entry$/ }, () => ({ path: '$ilia/entry', namespace: 'preview' }));
      build.onResolve({ filter: /.*/, namespace: 'preview' }, args => {
        const { path, importer } = args;
        if (path === '$ilia/component' && importer === '$ilia/entry') return { path: entry, namespace: 'preview' };
        if (path.startsWith('.') || path.startsWith('@/')) {
          const base = path.startsWith('@/') ? path.slice(2) : posix.normalize(posix.join(posix.dirname(importer), path));
          const resolved = matchFile(base);
          if (resolved) return { path: resolved, namespace: 'preview' };
          if (path === '@/lib/utils') return { path: '$ilia/utils', namespace: 'preview' };
          return { errors: [{ text: `请补充引用的文件 ${path}` }] };
        }
        if (dependencies.has(path)) return build.resolve(path, { resolveDir: workDir, kind: args.kind });
        if (args.kind === 'url-token' && /^data:/i.test(path)) return { path, external: true };
        return { errors: [{ text: `预览环境不支持依赖 ${path}` }] };
      });
      build.onLoad({ filter: /.*/, namespace: 'preview' }, ({ path }) => {
        if (path === '$ilia/entry') return { contents: runtime, loader: 'js' };
        if (path === '$ilia/utils') return { contents: builtinUtils, loader: 'js' };
        const ext = posix.extname(path).slice(1);
        return hasOwn(loaders, ext)
          ? { contents: files.get(path), loader: loaders[ext] }
          : { errors: [{ text: `预览环境不支持文件 ${path}` }] };
      });
    },
  };
}

async function tailwindStyles(files) {
  const [tailwind, oxide] = await Promise.all([import('tailwindcss'), import('@tailwindcss/oxide')]);
  const frameworkCss = await readFile(new URL(import.meta.resolve('tailwindcss/index.css')), 'utf8');
  const compiler = await tailwind.compile(frameworkCss, {
    loadStylesheet: async (name, base) => {
      if (!['./theme.css', './preflight.css', './utilities.css'].includes(name)) throw new Error('不支持的 Tailwind 样式文件');
      const path = import.meta.resolve(`tailwindcss/${name.slice(2)}`);
      return { path, base, content: await readFile(new URL(path), 'utf8') };
    },
  });
  const scanner = new oxide.Scanner({ sources: [] });
  return compiler.build(scanner.scanFiles([...files].filter(([name]) => /\.[jt]sx?$/.test(name)).map(([name, content]) => ({ content, extension: posix.extname(name).slice(1) }))));
}

async function buildReact(files, entry) {
  const esbuild = await import('esbuild');
  const result = await esbuild.build({
    absWorkingDir: workDir,
    entryPoints: ['$ilia/entry'],
    outfile: 'ilia-preview.js',
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    target: 'es2022',
    jsx: 'automatic',
    minify: true,
    legalComments: 'inline',
    tsconfigRaw: {},
    metafile: true,
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'silent',
    plugins: [virtualFiles(files, entry)],
  });
  const knownStyles = await tailwindStyles(files);
  const extraStyles = [...files].filter(([name]) => /\.css$/i.test(name) && !Object.hasOwn(result.metafile.inputs, 'preview:' + name)).map(([, content]) => content);
  const compiledStyles = result.outputFiles.find(file => file.path.endsWith('.css'))?.text || '';
  const styles = [compiledStyles, ...extraStyles].join('\n');
  const bundle = result.outputFiles.find(file => file.path.endsWith('.js')).text;
  return ready(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${inlineStyle(knownStyles)}\nbody{margin:0;padding:1rem} @media(prefers-color-scheme:dark){body{color:#f5f5f5;background:#1b1b1b}}\n${inlineStyle(styles)}</style><div id="preview"></div><script>${inlineScript(bundle)}</script></html>`);
}

export async function buildComponentPreview({ files, framework } = {}) {
  if (!Array.isArray(files) || !files.length) return needsInput('请粘贴或上传源码。');
  const sources = new Map();
  for (const { name, content } of files) {
    if (typeof name !== 'string' || typeof content !== 'string' || /(?:^|\/)\.\.(?:\/|$)|^\/|[\\\0]/.test(name)) {
      return needsInput('源码需要有相对文件名和文本内容。');
    }
    sources.set(posix.normalize(name), content);
  }
  const names = [...sources.keys()];
  const html = names.find(name => /(^|\/)index\.html?$/i.test(name)) || names.find(name => /\.html?$/i.test(name));
  if (framework === 'html' || (!framework && html)) {
    return html ? buildHtml(sources, html) : needsInput('请加入 HTML 入口文件。');
  }
  const entries = names.filter(name => /\.[jt]sx$/i.test(name));
  const entry = ['preview', 'app', 'index', 'component'].map(stem => entries.find(name => posix.basename(name, posix.extname(name)).toLowerCase() === stem)).find(Boolean) || entries[0];
  if (!entry) return needsInput('请加入 JSX 或 TSX 入口，或选择 HTML 格式。');
  try {
    return await buildReact(sources, entry);
  } catch (error) {
    const messages = error.errors?.map(item => item.text).slice(0, 4);
    const missing = messages?.some(message => /请补充|不支持依赖|Could not resolve/.test(message));
    const message = messages?.length ? messages.join('；') : 'React 预览环境不可用，请确认本地依赖已安装。';
    return { status: missing ? 'needs-input' : 'failed', message };
  }
}
