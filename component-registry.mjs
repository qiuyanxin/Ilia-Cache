import { publicUrl } from './media.mjs';

const fileLimit = 3_000_000;
const registryFile = /\.(?:html?|css|[cm]?js|tsx?|jsx|vue|svelte|json|md|txt)$/i;

function normalizedInput(value) {
  return value.replace(/\u00a0/g, ' ').replace(/https?\\:\/\//gi, match => match.replace('\\:', ':'));
}

export function registryUrlFromInput(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 6000) {
    throw new Error('请粘贴 shadcn 安装命令或 Registry JSON 链接');
  }
  const normalized = normalizedInput(value);
  const direct = normalized.match(/https?:\/\/[^\s'"`]+/i)?.[0]?.replace(/[),;]+$/, '');
  if (direct) return direct;
  const kokonut = normalized.match(/@kokonutui\/([a-z0-9][a-z0-9-]{0,120})\b/i)?.[1];
  if (kokonut) return `https://kokonutui.com/r/${kokonut}.json`;
  throw new Error('这条命令里没有识别到 Registry JSON 地址');
}

export function installCommandFromInput(value, registryUrl) {
  const normalized = normalizedInput(String(value || '')).trim();
  const argument = normalized.match(/\bnpx\s+shadcn@latest\s+add\s+([^\s'"`]+)/i)?.[1]?.replace(/[),;]+$/, '');
  return `npx shadcn@latest add ${argument || registryUrl}`;
}

export function normaliseRegistryItem(data, registryUrl, command = '') {
  if (!data || typeof data !== 'object' || !Array.isArray(data.files) || !data.files.length || data.files.length > 40) {
    throw new Error('Registry 没有提供可保存的组件源码');
  }
  let total = 0;
  const files = data.files.map((file, index) => {
    const rawName = typeof file?.target === 'string' && file.target || typeof file?.path === 'string' && file.path || `file-${index + 1}.txt`;
    const name = rawName.replace(/^\/+/, '');
    if (!registryFile.test(name) || name.split('/').some(part => !part || part === '.' || part === '..') || typeof file?.content !== 'string') {
      throw new Error('Registry 中包含不支持的源码文件');
    }
    total += Buffer.byteLength(file.content);
    if (total > fileLimit) throw new Error('Registry 源码合计超过 3 MB');
    return { name, content: file.content };
  });
  const joined = files.map(file => file.content).join('\n');
  const dependencies = [...new Set([...(data.dependencies || []), ...(data.registryDependencies || [])]
    .filter(value => typeof value === 'string' && value.trim() && value.length <= 200).map(value => value.trim()))].slice(0, 80);
  const license = joined.match(/@license\s*:?\s*([^\n*]+)/i)?.[1]?.trim().slice(0, 200) || '';
  const author = joined.match(/@author\s*:?\s*([^\n*]+)/i)?.[1]?.trim().slice(0, 200) || '';
  const framework = files.some(file => /\.(?:tsx|jsx)$/i.test(file.name)) ? 'react' :
    files.some(file => /\.html?$/i.test(file.name)) ? 'html' : undefined;
  return {
    name: typeof data.name === 'string' ? data.name.slice(0, 180) : '',
    type: typeof data.type === 'string' ? data.type.slice(0, 120) : '',
    registryUrl,
    command: installCommandFromInput(command, registryUrl).slice(0, 6000),
    files,
    dependencies,
    license,
    author,
    framework,
  };
}

export async function readComponentRegistry(input) {
  const requested = registryUrlFromInput(input);
  const url = await publicUrl(requested);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18000);
  try {
    const response = await fetch(url, {
      redirect: 'error', signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IliaDesignLibrary/1.0)', Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Registry 暂时无法读取（${response.status}）`);
    const length = Number(response.headers.get('content-length') || 0);
    if (length > fileLimit) throw new Error('Registry 响应超过 3 MB');
    const raw = await response.text();
    if (Buffer.byteLength(raw) > fileLimit) throw new Error('Registry 响应超过 3 MB');
    let data;
    try { data = JSON.parse(raw); } catch { throw new Error('这个地址没有返回有效的 Registry JSON'); }
    return normaliseRegistryItem(data, url.href, input);
  } finally {
    clearTimeout(timer);
  }
}
