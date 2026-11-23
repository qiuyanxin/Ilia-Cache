import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { buildPublicCatalog } from '../lib/public-catalog.mjs';
import { searchCatalog, searchDocument } from '../lib/catalog-search.mjs';
import { evaluate, tasks } from './evaluate-catalog.mjs';

const origin = new URL(process.argv[2] || 'http://127.0.0.1:4349');
if (origin.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname) ||
    origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
  throw new Error('本地模型必须运行在 loopback HTTP。');
}
const model = process.env.ILIA_EVAL_EMBEDDING_MODEL || 'Qwen3-Embedding-0.6B-Q8_0';
const seed = JSON.parse(await readFile(new URL('../public/seed.json', import.meta.url), 'utf8'));
const { components, version } = buildPublicCatalog(seed);
const documents = components.map(searchDocument);
const documentById = new Map(documents.map(doc => [doc.id, doc]));

async function embed(input) {
  const response = await fetch(new URL('/v1/embeddings', origin), {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, input, encoding_format: 'float' }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error('模型响应 HTTP ' + response.status + '：' + (await response.text()).slice(0, 200));
  const { data } = await response.json();
  if (data.length !== input.length) throw new Error('向量响应缺项。');
  return [...data].sort((a, b) => a.index - b.index).map(row => {
    const norm = Math.hypot(...row.embedding);
    if (!Number.isFinite(norm) || !norm) throw new Error('收到无效向量。');
    return Float32Array.from(row.embedding, value => value / norm);
  });
}

function eligible(task, id) {
  if (!Object.keys(task.required || {}).length) return true;
  const doc = documentById.get(id);
  return searchCatalog({ version, candidates: [doc] }, {
    intent: id, required: task.required, limit: 1,
  }).eligible.length === 1;
}

function rrf(lexical, semantic) {
  const scores = new Map();
  for (const channel of [lexical, semantic]) channel.forEach((id, i) => {
    scores.set(id, (scores.get(id) || 0) + 1 / (60 + i + 1));
  });
  return [...scores.keys()].sort((a, b) => scores.get(b) - scores.get(a) || a.localeCompare(b)).slice(0, 20);
}

const indexed = [];
const indexStart = performance.now();
for (let i = 0; i < components.length; i += 16) {
  const selected = components.slice(i, i + 16);
  const texts = selected.map(row => [row.title, row.originalName, row.category, row.description, ...row.tags].join('\n'));
  const vectors = await embed(texts);
  for (const [index, row] of selected.entries()) indexed.push({ id: row.id, vector: vectors[index] });
}
const indexMs = performance.now() - indexStart;
const lexical = [];
const semantic = [];
const hybrid = [];
const timings = [];
function similarity(a, b) {
  if (a.length !== b.length) throw new Error('索引与查询的向量维度不一致。');
  let score = 0;
  for (let i = 0; i < a.length; i += 1) score += a[i] * b[i];
  return score;
}
for (let offset = 0; offset < tasks.length; offset += 10) {
  await Promise.all(tasks.slice(offset, offset + 10).map(async task => {
    const start = performance.now();
    const keyword = searchCatalog({ version, candidates: documents }, {
      intent: task.intent, required: task.required, limit: 20,
    }).eligible.map(row => row.id);
    const [query] = await embed(['Instruct: Given a UI design requirement, retrieve components that satisfy the requested use.\nQuery: ' + task.intent]);
    const nearby = indexed
      .filter(item => eligible(task, item.id))
      .map(item => ({ id: item.id, score: similarity(item.vector, query) }))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, 20).map(row => row.id);
    const mixed = rrf(keyword, nearby);
    timings.push(performance.now() - start);
    lexical.push({ ...task, ids: keyword });
    semantic.push({ ...task, ids: nearby });
    hybrid.push({ ...task, ids: mixed });
  }));
}
timings.sort((a, b) => a - b);
const p95Ms = timings[Math.ceil(timings.length * 0.95) - 1];
const baseline = evaluate(lexical);
const merged = evaluate(hybrid);
console.log(JSON.stringify({
  model, dimension: indexed[0].vector.length, indexed: indexed.length, cases: tasks.length, indexMs,
  vectorBackend: '进程内精确余弦距离，未计入 pgvector 网络开销',
  lexical: baseline, semantic: evaluate(semantic), hybrid: merged, p95Ms,
  meetsActivationGate: merged.ndcg5 >= baseline.ndcg5 + 0.03 && merged.recall20 >= baseline.recall20 &&
    merged.constraintFalsePositives === 0 && p95Ms <= 800,
}, null, 2));
