import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname } from 'node:path';
import { build } from 'esbuild';

const directory = new URL('./', import.meta.url);
const workspace = new URL('../../../../../../', directory);
const output = new URL('data/builds/kash-series/交付/', workspace);
const local = 'http://127.0.0.1:4317';
const mime = { '.png': 'image/png', '.ttf': 'font/ttf', '.webp': 'image/webp' };
const embedded = new Map();

async function inlineAsset(url) {
  const key = url.href;
  if (!embedded.has(key)) {
    const payload = url.protocol === 'file:'
      ? await readFile(url)
      : await fetch(url).then(response => {
          if (!response.ok) throw Error('素材读取失败 ' + url.pathname);
          return response.arrayBuffer();
        });
    const type = mime[extname(url.pathname)];
    if (!type) throw Error('离线构建不支持的素材类型 ' + url.pathname);
    embedded.set(key, 'data:' + type + ';base64,' + Buffer.from(payload).toString('base64'));
  }
  return embedded.get(key);
}

async function replaceAsync(input, regex, convert) {
  const matches = [...input.matchAll(regex)];
  const converted = await Promise.all(matches.map(convert));
  let result = '';
  let end = 0;
  for (const [index, match] of matches.entries()) {
    result += input.slice(end, match.index) + converted[index];
    end = match.index + match[0].length;
  }
  return result + input.slice(end);
}

async function bundlePage(relative, filename) {
  const pageUrl = new URL(relative, directory);
  let html = await readFile(pageUrl, 'utf8');
  html = await replaceAsync(html, /<link rel="stylesheet" href="([^"]+)">/g, async ([, href]) => {
    const cssUrl = new URL(href, pageUrl);
    const css = await readFile(cssUrl, 'utf8');
    const inlined = await replaceAsync(css, /url\((['"]?)([^)'"]+)\1\)/g, async match => {
      if (match[2].startsWith('data:')) return match[0];
      return 'url("' + await inlineAsset(new URL(match[2], cssUrl)) + '")';
    });
    return '<style>\n' + inlined + '\n</style>';
  });
  html = await replaceAsync(html, /<script type="module" src="([^"]+)"><\/script>/g, async ([, href]) => {
    const { outputFiles } = await build({ entryPoints: [fileURLToPath(new URL(href, pageUrl))], bundle: true, format: 'iife', write: false });
    const js = await replaceAsync(outputFiles[0].text, /\/api\/assets\/[a-f0-9-]+\.png/g,
      async ([asset]) => inlineAsset(new URL(asset, local)));
    return '<script defer>\naddEventListener("DOMContentLoaded", () => {\n' + js.replaceAll('</script', '<\\/script') + '\n});\n</script>';
  });
  html = html.replace('../r09/index.html', './卡牌图鉴.html').replace('href="/#/projects"', 'href="' + local + '/#/projects"');
  if (filename === '卡牌图鉴.html') {
    html = html.replace('<h1>卡什的镭射收藏</h1>', '<h1>卡什的镭射收藏</h1>\n    <p><a href="./打开卡包.html">返回拆卡包</a></p>');
  } else {
    const notice = await readFile(new URL('creation-button.LICENSE.txt', directory), 'utf8');
    html = html.replace('</head>', '<!-- Motion Prompt #084\n' + notice + '\n-->\n</head>');
  }
  await writeFile(new URL(filename, output), html);
}

await mkdir(output, { recursive: true });
await bundlePage('./index.html', '打开卡包.html');
await bundlePage('../r09/index.html', '卡牌图鉴.html');
console.log(fileURLToPath(output));
