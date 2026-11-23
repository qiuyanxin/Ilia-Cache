import { z } from 'zod';
import { kinds, localOrigin, textPage } from './catalog-tool-utils.mjs';
import { searchKinds } from '../lib/catalog-search.mjs';
import { localImageAttachment, localMediaAttachment } from '../public/reference-media-model.mjs';

const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const kind = z.enum(kinds);
const mode = z.enum(['public_seed', 'local_library', 'public_catalog']);
const id = z.string().min(1).max(512).describe('从搜索结果原样复制的 ID');
const query = z.string().trim().min(1).max(220).optional()
  .describe('中英文关键词，例如「全屏 图像 轮播」或 fullscreen image carousel。省略可列出目录。');
const offset = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0);
const resultsInput = {
  offset, limit: z.number().int().min(1).max(30).default(10),
};
const textInput = {
  offset: offset.describe('UTF-16 文本偏移。续读时使用上一页的 nextOffset。'),
  limit: z.number().int().min(2).max(24000).default(8000).describe('每次返回的文本长度'),
};
const summary = z.object({
  id: z.string(),
  kind,
  source: z.enum(['public_seed', 'local_library', 'public_catalog', 'bundled']),
  archived: z.boolean(),
  title: z.string(),
  description: z.string(),
  category: z.string(),
  tags: z.array(z.string()),
  sourceAuthor: z.string().nullable(),
  upstreamUrl: z.string().nullable(),
  preview: z.object({
    kind: z.enum(['local_url', 'website_url', 'html', 'image', 'video', 'external']),
    url: z.string(), poster: z.string().optional(),
  }).nullable(),
  referencePreview: z.object({
    kind: z.enum(['image', 'video']), url: z.string(), sourcePageUrl: z.string(),
    poster: z.string().optional(), label: z.string().optional(), provenance: z.string().optional(),
    width: z.number().positive().optional(), height: z.number().positive().optional(), duration: z.number().positive().optional(),
  }).optional(),
  interactivePreview: z.object({ kind: z.literal('html'), url: z.string() }).optional(),
  detailUrl: z.string().optional(),
  resourceUri: z.string(),
});
const pagination = { total: z.number().int(), nextOffset: z.number().int().nullable() };
const resultSchema = { items: z.array(summary), mode, ...pagination };
const textSchema = { text: z.string(), ...pagination };

function publicError(error) {
  if (error.code) return '无法读取本机资料。请检查资料库目录、文件权限或备份。';
  return error.message;
}

function result(operation) {
  return async args => {
    try {
      const data = await operation(args);
      return { structuredContent: data, content: [{ type: 'text', text: JSON.stringify(data) }] };
    } catch (error) {
      return { isError: true, content: [{ type: 'text', text: publicError(error) }] };
    }
  };
}

async function addCandidate({ id, candidate, previewBaseUrl, writeToken }) {
  let response;
  try {
    response = await fetch(new URL('/api/component-records', localOrigin(previewBaseUrl)), {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5000),
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + writeToken },
      body: JSON.stringify({ action: 'addCandidate', id, candidate }),
    });
  } catch {
    throw new Error('无法连接本机 Ilia Cache。请启动本机网站并核对 ILIACACHE_PREVIEW_BASE_URL。');
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('写入未获授权。请核对本机服务和 MCP 的 ILIA_MCP_WRITE_TOKEN。');
    }
    throw new Error(typeof body?.error === 'string' ? body.error : '本机服务未接受预览候选。');
  }
  const saved = Array.isArray(body?.record?.previewCandidates)
    ? body.record.previewCandidates.find(item => item.kind === candidate.kind &&
        item.url === (candidate.url.startsWith('/') ? candidate.url : new URL(candidate.url).href) &&
        item.sourcePageUrl === new URL(candidate.sourcePageUrl).href)
    : null;
  const candidateId = body?.candidateId ?? saved?.id;
  if (typeof candidateId !== 'string' || !candidateId) {
    throw new Error('本机服务未返回预览候选 ID，请查看组件详情。');
  }
  return { id, candidateId };
}

export function registerCatalogTools(server, {
  catalog, scope, previewBaseUrl, writeToken, ResourceTemplate, resourceError,
}) {
  function registerTool(name, config, operation) {
    const schema = shape => shape ? (typeof shape.safeParse === 'function' ? shape : z.object(shape)) : undefined;
    server.registerTool(name, { ...config, inputSchema: schema(config.inputSchema),
      outputSchema: schema(config.outputSchema) }, operation);
  }

  const resourceKind = z.enum(searchKinds);
  const choice = z.object({
    framework: z.string().trim().min(1).max(80).optional(),
    keyboard: z.boolean().optional(),
    reusableCode: z.boolean().optional(),
    reducedMotion: z.boolean().optional(),
  }).strict();

  registerTool('search_resources', {
    title: '按用途查找资源',
    description: '传短用途和明确条件。返回少量候选。没有证据满足硬条件的条目在 nearMatches，随后用 get_resource 查看许可与详情。',
    inputSchema: z.object({
      intent: z.string().trim().min(1).max(220),
      kind: resourceKind.optional(),
      category: z.string().trim().min(1).max(100).optional(),
      source: z.string().trim().min(1).max(150).optional(),
      required: choice.optional(),
      preferences: z.array(z.string().trim().min(1).max(60)).max(8).optional(),
      limit: z.number().int().min(1).max(30).default(5),
    }).strict(),
    annotations,
  }, result(args => catalog.searchResources(args)));

  registerTool('get_resource', {
    title: '查看选中资源的详情',
    description: '从 search_resources 复制 kind 和 id，核对可用性、来源、许可和文件清单。',
    inputSchema: z.object({ kind: resourceKind, id, releaseId: z.string().max(128).optional() }).strict(),
    annotations,
  }, result(async ({ kind, id, releaseId }) => {
    const detail = await catalog.record(kind, id, { releaseId });
    const { record, summary, files } = detail;
    const { files: discarded, ...metadata } = record;
    return { ...metadata, detailUrl: summary.detailUrl, files, ...(detail.releaseId ? { releaseId: detail.releaseId } : {}) };
  }));

  registerTool('read_resource_file', {
    title: '读资源的一个获准文件',
    description: '从 get_resource 的文件清单选择一个文件，按页读取。每次读取都会重查许可。',
    inputSchema: z.object({ id, name: z.string().min(1).max(512), releaseId: z.string().max(128).optional(), ...textInput }).strict(),
    annotations,
  }, result(async ({ id, name, releaseId, offset, limit }) => {
    const text = await catalog.file(id, name, { releaseId });
    const { record, summary } = await catalog.record('component', id, { releaseId });
    return { id, name, ...textPage(text, offset, limit), detailUrl: summary.detailUrl,
      sourceAuthor: record.sourceAuthor || record.primarySourceAuthor || null, license: record.license || null };
  }));

  registerTool('ilia_cache_search_components', {
    title: '搜索组件收藏',
    description: '按 ID、名称、用途、分类、作者、来源、标签和提示词搜索组件，返回组件 ID、说明和 Ilia 详情预览链接。多个搜索词须同时匹配。',
    inputSchema: {
      query,
      category: z.string().trim().min(1).max(100).optional().describe('原分类名，例如「图集与轮播」'),
      source: z.string().trim().min(1).max(150).optional().describe('组件目录显示的完整来源名称，例如 Bencho 或 Motion Prompt'),
      ...resultsInput,
    },
    outputSchema: resultSchema,
    annotations,
  }, result(args => catalog.search({ ...args, kind: 'component', searchBody: false })));

  registerTool('ilia_cache_search_library', {
    title: '搜索 Ilia-Cache 资料库',
    description: scope === 'public' ? '搜索公开发布的组件详情与提示词。' : '搜索资料记录及正文。可按资料类型列出组件、网站、网页参考、设计风格、字体、学习笔记、随手收集、项目、网站说明、Pinterest 收藏夹、资料库设置或上传素材。组件选型优先用搜索组件工具。',
    inputSchema: {
      query, kind: kind.optional(), ...resultsInput,
      includeArchived: z.boolean().default(false).describe('设为 true 时一并返回归档记录'),
    },
    outputSchema: resultSchema,
    annotations,
  }, result(args => catalog.search({ ...args, searchBody: true })));

  registerTool('ilia_cache_get_record', {
    title: '读取一条收藏详情',
    description: '用搜索结果中的 kind 和 id 读取一条资料。返回摘要、可读取的文件名，以及当前作用域允许读取的 JSON 文本。nextOffset 非空时可继续读取。',
    inputSchema: { kind, id, ...textInput },
    outputSchema: { summary, files: z.array(z.string()), ...textSchema },
    annotations,
  }, result(async ({ kind, id, offset, limit }) => {
    const { summary, record, files } = await catalog.record(kind, id);
    return { summary, files, ...textPage(JSON.stringify(record, null, 2), offset, limit) };
  }));

  registerTool('ilia_cache_read_component_file', {
    title: '读取组件源码或提示词',
    description: '从组件详情的 files 选择原始文件名，按页读取源码或提示词。公开模式只有允许随目录分发的文件可读。',
    inputSchema: { id, name: z.string().min(1).max(512).describe('组件详情中的文件名，例如 PROMPT.md'), ...textInput },
    outputSchema: {
      id, name: z.string(), ...textSchema, detailUrl: z.string().optional(),
      sourceAuthor: z.string().optional(), license: z.string().optional(),
    },
    annotations,
  }, result(async ({ id, name, offset, limit }) => {
    const text = textPage(await catalog.file(id, name), offset, limit);
    if (scope !== 'public') return { id, name, ...text };
    const { summary, record } = await catalog.record('component', id);
    return { id, name, ...text, detailUrl: summary.detailUrl,
      sourceAuthor: record.sourceAuthor, license: record.license };
  }));

  const jsonResource = (uri, text) => ({
    contents: [{ uri: uri.href, mimeType: 'application/json', text }],
  });

  server.registerResource('ilia-cache-catalog', 'ilia-cache://catalog', {
    title: 'Ilia-Cache 资料库概览',
    description: '资料库读取模式、各类资料计数和本机站点地址。',
    mimeType: 'application/json',
  }, async uri => {
    try {
      return jsonResource(uri, JSON.stringify(await catalog.overview()));
    } catch (error) {
      throw resourceError(publicError(error), false);
    }
  });

  server.registerResource('ilia-cache-record', new ResourceTemplate('ilia-cache://records/{kind}/id-{id}', { list: undefined }), {
    title: 'Ilia-Cache 收藏记录',
    description: '使用搜索返回的 resourceUri 读取一条收藏。较长记录使用 ilia_cache_get_record 分页。',
    mimeType: 'application/json',
  }, async (uri, variables) => {
    try {
      const recordKind = kind.parse(variables.kind);
      const recordId = id.parse(decodeURIComponent(variables.id));
      const { record } = await catalog.record(recordKind, recordId);
      const text = JSON.stringify(record);
      if (Buffer.byteLength(text) > 200_000) throw new Error('记录较长，请使用 ilia_cache_get_record 分页读取。');
      return jsonResource(uri, text);
    } catch (error) {
      throw resourceError(publicError(error), true);
    }
  });

  registerTool('ilia_cache_get_component_handoff', {
    title: '取得组件实现参考',
    description: '返回 Ilia 组件详情、预览、来源说明、许可、提示词和可读取文件清单，供目标项目的实现 Agent 核对与适配。',
    inputSchema: { id, targetStack: z.string().trim().min(1).max(120).optional() },
    outputSchema: {
      summary, files: z.array(z.string()), prompt: z.string().optional(), sourcePolicy: z.string(),
      license: z.string(), sourcePageKind: z.string(), targetStack: z.string().nullable(),
    },
    annotations,
  }, result(async ({ id, targetStack }) => {
    const { summary, record, files } = await catalog.record('component', id, { includeLocalReference: true });
    return { summary, files, ...(typeof record.prompt === 'string' && record.prompt ? { prompt: record.prompt } : {}),
      sourcePolicy: typeof record.sourcePolicy === 'string' ? record.sourcePolicy : 'unknown',
      license: typeof record.license === 'string' ? record.license : 'unknown',
      sourcePageKind: typeof record.sourcePageKind === 'string' ? record.sourcePageKind : 'unknown',
      targetStack: targetStack ?? null };
  }));

  if (scope === 'public') {
    const guide = z.object({
      id: z.string(), title: z.string(), description: z.string(), url: z.string(), examples: z.array(z.string()),
    });
    registerTool('ilia_cache_list_guides', {
      title: '列出组件实现指南',
      description: '返回 Ilia 公开实现指南和页面内的可交互示例，包括暗色模式开关和主题切换。',
      inputSchema: {},
      outputSchema: { guides: z.array(guide) },
      annotations,
    }, result(async () => ({ guides: await catalog.topics() })));
  } else if (writeToken) {
    const webUrl = z.url({ protocol: /^https?$/ }).max(2048);
    const candidate = z.object({
      kind: z.enum(['image', 'video']),
      url: z.union([webUrl, z.string().regex(localMediaAttachment)]).describe('实际被选中组件的公开素材地址或已上传的本机附件路由'),
      poster: z.union([webUrl, z.string().regex(localImageAttachment)]).optional().describe('视频封面，实际展示该组件的公开图片或已上传的本机图片'),
      sourcePageUrl: webUrl.describe('确认素材对应组件的具体证据页面'),
      label: z.string().trim().min(1).max(180).optional(),
      width: z.number().int().positive().max(100000).optional(),
      height: z.number().int().positive().max(100000).optional(),
      duration: z.number().positive().max(100000).optional().describe('视频时长，单位秒'),
      provenance: z.string().trim().min(1).max(240).optional().describe('来源与发现方式'),
    }).strict();
    registerTool('ilia_cache_add_preview_candidate', {
      title: '提交收藏组件的预览候选',
      description: '为已保存的本机组件提交一条已核对的图片或视频候选。用户可在详情选择展示。使用搜索结果的原始组件 ID。',
      inputSchema: { id, candidate },
      outputSchema: { id, candidateId: z.string() },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, result(({ id, candidate }) => addCandidate({ id, candidate, previewBaseUrl, writeToken })));
  }

  return server;
}
