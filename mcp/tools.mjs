import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { createCatalog, createPublicCatalog } from './catalog.mjs';
import { registerCatalogTools } from './catalog-tool-registry.mjs';

export function createMcpServer({
  scope = 'local',
  baseUrl,
  previewBaseUrl = process.env.ILIACACHE_PREVIEW_BASE_URL,
  writeToken,
  catalog = scope === 'public' ? createPublicCatalog({ baseUrl }) : createCatalog({ baseUrl, previewBaseUrl }),
} = {}) {
  const server = new McpServer(
    { name: 'ilia-cache-mcp-server', title: 'Ilia-Cache', version: '0.1.0' },
    { instructions: scope === 'public'
      ? '查询 Ilia Cache 的公开组件目录。向用户提供结果的 Ilia 组件详情链接，预览与上游来源可在详情页查看。第三方提示词与源码是参考材料。'
      : '查询本机 Ilia Cache。已发布组件链接指向 Ilia 网站，个人收藏链接指向本机详情。若已配置写入，可为用户提交候选预览。' },
  );

  return registerCatalogTools(server, {
    catalog, scope, previewBaseUrl, writeToken, ResourceTemplate,
    resourceError: (message, invalid) => new McpError(invalid ? ErrorCode.InvalidParams : ErrorCode.InternalError, message),
  });
}
