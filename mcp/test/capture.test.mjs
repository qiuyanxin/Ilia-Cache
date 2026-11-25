import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '../tools.mjs';

test('本机 MCP 将候选提交给受授权的本机保存接口，公开 MCP 未注册写入工具', async t => {
  const candidate = {
    kind: 'video', url: 'https://example.com/media/menu.mp4', poster: '/api/assets/abcd.png',
    sourcePageUrl: 'https://example.com/demo/menu', width: 720, height: 480,
  };
  const token = 'in-memory-token-used-only-for-testing';
  let observed;
  const backend = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    observed = {
      path: req.url, auth: req.headers.authorization, origin: req.headers.origin,
      body: JSON.parse(Buffer.concat(chunks)),
    };
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ record: { previewCandidates: [{ id: 'preview-123', ...candidate }] } }));
  });
  backend.listen(0, '127.0.0.1');
  await once(backend, 'listening');
  t.after(async () => {
    backend.closeAllConnections();
    await new Promise(resolve => backend.close(resolve));
  });

  const previewBaseUrl = `http://127.0.0.1:${backend.address().port}`;
  const previous = process.env.ILIACACHE_PREVIEW_BASE_URL;
  process.env.ILIACACHE_PREVIEW_BASE_URL = previewBaseUrl;
  t.after(() => {
    if (previous === undefined) delete process.env.ILIACACHE_PREVIEW_BASE_URL;
    else process.env.ILIACACHE_PREVIEW_BASE_URL = previous;
  });
  async function connect(scope, writeToken) {
    const server = createMcpServer({ scope, writeToken });
    const client = new Client({ name: 'ilia-capture-test', version: '0.1.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    t.after(() => client.close());
    return client;
  }
  const toolName = 'ilia_cache_add_preview_candidate';
  const commands = { id: 'menu-demo', candidate };
  const local = await connect('local', token);
  const tool = (await local.listTools()).tools.find(tool => tool.name === toolName);
  assert.equal(tool.annotations.readOnlyHint, false);
  const response = await local.callTool({ name: toolName, arguments: commands });
  assert.deepEqual(response.structuredContent, { id: 'menu-demo', candidateId: 'preview-123' });
  assert.deepEqual(observed, {
    path: '/api/component-records', auth: 'Bearer ' + token, origin: undefined,
    body: { action: 'addCandidate', ...commands },
  });
  const disabled = await connect('local');
  const published = await connect('public', token);
  for (const client of [disabled, published]) {
    assert.equal((await client.listTools()).tools.some(tool => tool.name === toolName), false);
  }
});
