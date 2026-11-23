import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createPublicCatalog } from '../mcp/catalog.mjs';

const { tasks } = JSON.parse(await readFile(new URL('../test/fixtures/catalog-search-questions.json', import.meta.url), 'utf8'));
const catalog = createPublicCatalog();

export function evaluate(rows) {
  const positive = rows.filter(row => row.relevantIds.length);
  const recall = selected => selected.reduce((sum, row) =>
    sum + row.relevantIds.filter(id => row.ids.slice(0, 20).includes(id)).length / row.relevantIds.length, 0) /
    selected.length;
  function ndcg(row) {
    const gain = row.ids.slice(0, 5).reduce((sum, id, index) => sum +
      (row.relevantIds.includes(id) ? 1 / Math.log2(index + 2) : 0), 0);
    const ideal = row.relevantIds.slice(0, 5).reduce((sum, _, index) => sum + 1 / Math.log2(index + 2), 0);
    return gain / ideal;
  }
  return {
    recall20: recall(positive),
    intentRecall20: recall(positive.filter(row => row.group === 'intent')),
    ndcg5: positive.reduce((sum, row) => sum + ndcg(row), 0) / positive.length,
    exactAt1: rows.filter(row => row.group === 'exact-id' && row.ids[0] === row.relevantIds[0]).length,
    constraintFalsePositives: rows.filter(row => row.group === 'constraints' && row.ids.length).length,
  };
}

async function apiCall(endpoint, tool, args) {
  const response = await fetch(endpoint, { method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream',
      'mcp-protocol-version': '2025-11-25' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call',
      params: { name: tool, arguments: args } }),
    signal: AbortSignal.timeout(5000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error('MCP HTTP ' + response.status);
  const result = JSON.parse(text.startsWith('event:')
    ? text.split('\n').find(line => line.startsWith('data: ')).slice(6) : text).result;
  if (result?.isError || !result?.structuredContent) throw new Error('MCP 调用失败：' + JSON.stringify(result));
  return result.structuredContent;
}

export { apiCall, tasks };

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  const endpoint = process.argv[2];
  const old = [];
  const lexical = [];
  const timings = [];
  const run = task => {
    const request = { intent: task.intent, kind: 'component', required: task.required, limit: 20 };
    return endpoint ? apiCall(endpoint, 'search_resources', request) : catalog.searchResources(request);
  };
  await run(tasks[0]);
  for (let i = 0; i < tasks.length; i += 10) {
    const group = tasks.slice(i, i + 10);
    const batch = await Promise.all(group.map(async task => {
      const start = performance.now();
      const result = await run(task);
      timings.push(performance.now() - start);
      return { ...task, ids: result.eligible.map(row => row.id) };
    }));
    lexical.push(...batch);
  }
  for (const task of tasks) {
    const result = await catalog.search({ kind: 'component', offset: 0, limit: 20, query: task.intent });
    old.push({ ...task, ids: result.items.map(row => row.id) });
  }
  timings.sort((a,b) => a - b);
  const exactCases = tasks.filter(task => task.group === 'exact-id').length;
  console.log(JSON.stringify({ source: endpoint || '内存公开快照，未测数据库延迟', cases: tasks.length, exactCases,
    previous: evaluate(old), lexical: evaluate(lexical), p95Ms: timings[Math.ceil(timings.length * 0.95) - 1],
    missing: lexical.filter(row => row.relevantIds.length && !row.relevantIds.some(id => row.ids.includes(id)))
      .map(({ intent, relevantIds, ids }) => ({ intent, relevantIds, top: ids.slice(0, 3) })),
    casesWithFalsePositives: lexical.filter(row => row.group === 'constraints' && row.ids.length)
      .map(({ intent, ids }) => ({ intent, ids })),
  }, null, 2));
}
