// Shared by the SQLite and PostgreSQL adapters. Indexed terms have no SQL syntax.
const segmenter = new Intl.Segmenter('zh', { granularity: 'word' });
const lexicalRules = [
  [/前后(?:图|图片)?对比|前后效果|before[\s/_-]*after|image[\s_-]*compar(?:e|ison)|图片对比|对比滑块/gu, ' compare reveal '],
  [/分隔线|分割线|divider|splitter/gu, ' divider '],
  [/拖拽|拖动|拖曳|拖拉|dragging|draggable/gu, ' drag '],
  [/图片|图像|照片|影像|\b(?:images?|photos?|pictures?)\b/gu, ' image '],
  [/轮播|幻灯片|\b(?:carousels?|slideshows?)\b/gu, ' carousel '],
  [/全屏(?:幕)?|全窗口|\bfull[\s_-]*(?:screen|viewport)\b/gu, ' fullscreen '],
  [/回弹|弹簧|springy|springback/gu, ' spring '],
  [/键盘|keyboard/gu, ' keyboard '],
  [/深色模式|暗色模式|黑夜模式|\bdark[\s_-]*mode\b/gu, ' dark mode '],
  [/切换主题|主题切换|\btheme[\s_-]*(?:switch|toggle)\b/gu, ' theme toggle '],
  [/滚动|\bscroll(?:ing)?\b/gu, ' scroll '],
  [/悬停|鼠标经过|\bhover(?:ing)?\b/gu, ' hover '],
  [/光标|鼠标指针|\bcursor\b/gu, ' cursor '],
  [/加载中|载入|\bload(?:ing|er)?\b/gu, ' loading '],
  [/模糊|\bblur(?:red)?\b/gu, ' blur '],
  [/背景|\bbackground\b/gu, ' background '],
  [/导航|\bnavigation\b/gu, ' navigation '],
  [/音效|\bsound[\s_-]*effects?\b/gu, ' sound '],
  [/字体|\bfonts?\b/gu, ' font '],
];
const fillers = /都有哪些|帮我找一下|帮我找|可以|用于|适合|有哪些|有没有|能不能|我想找|有没有|请问|组件|控件|效果|实现|的时候/gu;
const stopWords = new Set([
  'a', 'an', 'the', 'and', 'for', 'of', 'to', 'with', 'in', 'on', 'at', 'is',
  'find', 'show', 'me', 'component', 'components', 'make', 'use', 'using',
  '的', '有', '一个', '一', '个', '在', '给', '用', '要', '想', '找', '想要', '需要',
  '能', '可以', '支持', '要求', '必须', '最好', '页面', '时', '会', '和', '或', '与',
]);
const fieldText = value => typeof value === 'string' ? value.trim() : '';
const folded = value => fieldText(value).normalize('NFKC').toLowerCase();
const sorted = new Intl.Collator('zh', { numeric: true, sensitivity: 'base' });
const hardFields = new Set(['framework', 'keyboard', 'reusableCode', 'reducedMotion']);
export const searchKinds = [
  'component', 'website', 'page', 'resource', 'style', 'font', 'lesson', 'capture',
  'project', 'site_summary', 'pinterest_board', 'library_settings', 'asset', 'sound',
];

function tokens(text) {
  const value = folded(text).replace(/[^\p{L}\p{N}]+/gu, ' ');
  return [...segmenter.segment(value)].filter(part => part.isWordLike).map(part => part.segment);
}

function expanded(text) {
  let value = folded(text);
  for (const [pattern, replacement] of lexicalRules) value = value.replace(pattern, replacement);
  return value;
}

export function searchTerms(intent) {
  return [...new Set(tokens(expanded(intent).replace(fillers, ' ')).filter(term => !stopWords.has(term)))]
    .slice(0, 32);
}

// Only an explicit verified fact can satisfy a hard constraint. Editorial text,
// previews and licensing descriptions are searchable but do not become facts.
function verifiedFacts(value) {
  const evidence = {};
  for (const key of hardFields) {
    const fact = value?.[key];
    if (fact?.status !== 'verified' || !fieldText(fact.source)) continue;
    const valid = key === 'framework'
      ? Array.isArray(fact.value) && fact.value.length > 0 && fact.value.every(item => typeof item === 'string')
      : typeof fact.value === 'boolean';
    if (valid) evidence[key] = { value: fact.value, source: fieldText(fact.source).slice(0, 500) };
  }
  return evidence;
}

export function searchDocument(record) {
  const title = fieldText(record.title || record.name || record.displayTitle || record.id);
  const originalName = fieldText(record.originalName || record.english);
  const category = fieldText(record.componentCategory || record.pageCategory || record.category || record.group);
  const sourceName = fieldText(record.sourceName || record.sourceShort ||
    (typeof record.source === 'string' ? record.source : ''));
  const description = fieldText(record.description || record.note || record.finds);
  const descriptive = [
    description, category, sourceName, record.sourceAuthor || record.primarySourceAuthor,
    ...(Array.isArray(record.tags) ? record.tags : []),
    ...(Array.isArray(record.searchAliases) ? record.searchAliases : []),
  ].filter(value => typeof value === 'string').join(' ');
  const titleTerms = new Set([...tokens(title + ' ' + originalName), ...searchTerms(title + ' ' + originalName)]);
  const terms = [...new Set([...titleTerms, ...tokens(descriptive), ...searchTerms(descriptive)])]
    .filter(term => !stopWords.has(term)).slice(0, 256);
  return {
    id: record.id, kind: record.kind || 'component', title, originalName, category, sourceName, description,
    terms, titleTerms: [...titleTerms], evidence: verifiedFacts(record.evidence),
    sourcePolicy: fieldText(record.sourcePolicy) || 'source-link-only',
    detailPath: fieldText(record.detailPath || record.path),
  };
}

function constraints(required, evidence) {
  const status = {};
  for (const [key, expected] of Object.entries(required)) {
    const actual = evidence[key]?.value;
    status[key] = actual === undefined ? 'unknown' :
      (key === 'framework' ? actual.some(value => folded(value) === folded(expected)) : actual === expected)
        ? 'verified' : 'not_met';
  }
  return status;
}

function lexicalScore(document, request, terms) {
  const exact = folded(request.intent);
  if (exact && folded(document.id) === exact) return 10000;
  if (exact && (folded(document.title) === exact || folded(document.originalName) === exact)) return 1000;
  if (!terms.length) return exact ? -1 : 0;
  const indexed = new Set(document.terms);
  const title = new Set(document.titleTerms);
  let score = terms.reduce((sum, term) => sum + (title.has(term) ? 5 : indexed.has(term) ? 2 : 0), 0);
  if (!score) return -1;
  if (document.terms.includes('compare') && terms.includes('compare')) score += 8;
  const matched = terms.filter(term => indexed.has(term)).length;
  score += matched / terms.length;
  for (const preference of request.preferences || []) {
    if (preference === 'reusable-code' && document.sourcePolicy === 'bundled-source') score += 1;
    else if (searchTerms(preference).some(term => indexed.has(term))) score += 0.5;
  }
  return score;
}

export function searchCatalog({ version, candidates }, request) {
  const terms = searchTerms(request.intent);
  const ranked = candidates.filter(document =>
    (!request.kind || document.kind === request.kind) &&
    (!request.category || folded(document.category) === folded(request.category)) &&
    (!request.source || folded(document.sourceName) === folded(request.source)),
  ).map(document => ({ document, score: lexicalScore(document, request, terms) }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score || sorted.compare(a.document.title, b.document.title) ||
      sorted.compare(a.document.id, b.document.id));
  const eligible = [];
  const nearMatches = [];
  for (const { document } of ranked) {
    const evidence = constraints(request.required || {}, document.evidence);
    const hit = {
      id: document.id, kind: document.kind, title: document.title, category: document.category,
      description: document.description.slice(0, 220), detailPath: document.detailPath,
      sourcePolicy: document.sourcePolicy, evidence,
      matchedTerms: terms.filter(term => document.terms.includes(term)),
    };
    (Object.values(evidence).every(status => status === 'verified') ? eligible : nearMatches).push(hit);
  }
  const limit = Math.max(1, Math.min(request.limit ?? 5, 30));
  const exactCount = eligible.length;
  return { releaseId: String(version), eligible: eligible.slice(0, limit),
    nearMatches: nearMatches.slice(0, Math.max(0, limit - Math.min(limit, exactCount))), total: exactCount };
}
