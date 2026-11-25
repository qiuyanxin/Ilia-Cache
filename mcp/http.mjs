import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from './tools.mjs';

const maximumBodyBytes = 64 * 1024;

function errorResponse(res, status, message) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message }, id: null }));
}

async function requestBody(req) {
  let bytes = 0;
  const chunks = [];
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    bytes += chunk.length;
    if (bytes > maximumBodyBytes) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function parsedOrigin(value) {
  if (!value) return null;
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) throw new Error('Expected an HTTP(S) origin.');
  return url;
}

export function createPublicMcpHttpServer({ baseUrl, endpointOrigin } = {}) {
  const site = parsedOrigin(baseUrl);
  const endpoint = parsedOrigin(endpointOrigin);
  const origins = new Set([site?.origin, endpoint?.origin].filter(Boolean));
  const hosts = new Set([site?.host, endpoint?.host].filter(Boolean));

  return createServer(async (req, res) => {
    if (req.url !== '/mcp') return errorResponse(res, 404, 'MCP endpoint is /mcp');
    if (!hosts.has(req.headers.host) && !/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(req.headers.host || '')) {
      return errorResponse(res, 403, 'Invalid Host');
    }
    const origin = req.headers.origin;
    if (origin && !origins.has(origin)) return errorResponse(res, 403, 'Invalid Origin');
    if (req.method !== 'POST') {
      res.setHeader('allow', 'POST');
      return errorResponse(res, 405, 'Method Not Allowed');
    }
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
      return errorResponse(res, 415, 'Expected application/json');
    }

    let server;
    try {
      const text = await requestBody(req);
      if (text === null) return errorResponse(res, 413, 'Request too large');
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        return errorResponse(res, 400, 'Invalid JSON');
      }
      server = createMcpServer({ scope: 'public', baseUrl });
      const transport = new StreamableHTTPServerTransport({ enableJsonResponse: true });
      res.once('close', () => { void server.close(); });
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch {
      if (!res.headersSent) errorResponse(res, 500, 'Unable to process MCP request');
      else res.end();
      await server?.close();
    }
  });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const host = process.env.ILIACACHE_MCP_HOST || '127.0.0.1';
  const port = Number(process.env.ILIACACHE_MCP_PORT || '4319');
  createPublicMcpHttpServer({
    baseUrl: process.env.ILIACACHE_PUBLIC_BASE_URL,
    endpointOrigin: process.env.ILIACACHE_MCP_ORIGIN,
  }).listen(port, host, () => console.error(`Ilia public MCP: http://${host}:${port}/mcp`));
}
