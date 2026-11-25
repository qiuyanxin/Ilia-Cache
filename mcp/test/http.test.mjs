import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createPublicMcpHttpServer } from '../http.mjs';

test('公开 Streamable HTTP 使用无会话传输，只提供公开目录和实现指南', async t => {
  const server = createPublicMcpHttpServer({ baseUrl: 'https://ilia.example.com' });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = new URL(`http://127.0.0.1:${server.address().port}/mcp`);
  const client = new Client({ name: 'ilia-public-mcp-test', version: '0.1.0' });
  t.after(async () => {
    await client.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  await client.connect(new StreamableHTTPClientTransport(url));
  const { tools } = await client.listTools();
  assert.ok(tools.length >= 4 && tools.every(tool => tool.annotations.readOnlyHint));
  assert.equal(tools.some(({ name }) => name.includes('add_preview_candidate')), false);
  const guide = await client.callTool({ name: 'ilia_cache_list_guides', arguments: {} });
  assert.equal(guide.structuredContent.guides[0].url, 'https://ilia.example.com/components/dark-mode-toggle');
  const result = await client.callTool({
    name: 'ilia_cache_get_record', arguments: { kind: 'component', id: 'reactbits-squish-switch' },
  });
  assert.equal(result.structuredContent.summary.detailUrl, 'https://ilia.example.com/components/reactbits-squish-switch');
  assert.deepEqual(result.structuredContent.summary.preview, {
    kind: 'website_url', url: result.structuredContent.summary.detailUrl,
  });
  assert.deepEqual(result.structuredContent.files, []);
  assert.doesNotMatch(JSON.stringify(result.structuredContent), /reactbits\.dev/);
  const search = await client.callTool({
    name: 'ilia_cache_search_components', arguments: { query: 'squishswitch' },
  });
  const item = search.structuredContent.items.find(row => row.id === 'reactbits-squish-switch');
  assert.equal(item.preview.url, result.structuredContent.summary.detailUrl);
  assert.equal(item.upstreamUrl, null);
  const fromSource = await client.callTool({
    name: 'ilia_cache_search_components', arguments: { category: '图集与轮播', source: 'Bencho' },
  });
  assert.deepEqual(fromSource.structuredContent.items.map(({ id }) => id), [
    '4cbfeca4-e4db-402e-8b1f-a1aa0aa96012', 'leibox-image-accordion',
  ]);
  const handoff = await client.callTool({
    name: 'ilia_cache_get_component_handoff', arguments: { id: 'motion-prompt-059' },
  });
  assert.equal(handoff.structuredContent.summary.detailUrl, 'https://ilia.example.com/components/motion-prompt-059');
  assert.equal(handoff.structuredContent.prompt, undefined);
  assert.doesNotMatch(JSON.stringify(handoff.structuredContent), /showheyohtaki\.github\.io/);
  const invalid = await fetch(url, { method: 'POST', headers: { origin: 'https://irrelevant.example.org' } });
  assert.equal(invalid.status, 403);
});
