export const COMPONENT_CATEGORIES = [
  '按钮与输入', '菜单与导航', '图集与轮播', '卡片', '文字', '提示与状态', '拖拽与编辑',
  '页面与转场', '动效与镜头', '视觉风格', '图表与图解', '表面与质感', '背景与物体', '音效',
];

const stopWords = new Set(['a', 'an', 'the', 'for', 'of', 'component', 'components', 'find', 'show', 'me', 'what', 'are', 'there']);
const order = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
const text = value => typeof value === 'string' ? value : '';
const join = values => values.filter(value => typeof value === 'string').join(' ');

export function normalizeSearchText(value) {
  return text(value).normalize('NFKC').toLowerCase()
    .replace(/全屏(?:幕)?|全窗口|\bfull[\s_-]*screen\b|\bfull[\s_-]*viewport\b/gu, ' fullscreen ')
    .replace(/图像|影像|图片|照片|\b(?:images?|photos?|pictures?)\b/gu, ' image ')
    .replace(/轮播|幻灯片|\b(?:carousels?|slideshows?)\b/gu, ' carousel ')
    .replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/gu, ' ').trim();
}

export function prepareSearchQuery(query) {
  const raw = text(query).normalize('NFKC').trim().toLowerCase();
  const keywords = raw.replace(/(?:都有哪些|帮我找一下|帮我找|请问|有没有|有哪些|有什么|组件|控件|的)/gu, ' ');
  const terms = [...new Set(normalizeSearchText(keywords).split(' ').filter(term => term && !stopWords.has(term)))];
  return { raw, terms };
}

/** Adapt browser rows and the published MCP projection to the same searchable fields. */
export function componentSearchFields(record, { category, source, url, localMetadata } = {}) {
  const tags = Array.isArray(record.tags) ? record.tags : [];
  const collection = typeof record.collectionSource === 'string' ? record.collectionSource : record.collectionSource?.name;
  return {
    id: text(record.id).normalize('NFKC').toLowerCase(),
    title: join([record.name || record.title, record.originalName]),
    metadata: join([
      record.id, record.description, category ?? record.componentCategory ?? record.category,
      ...tags, record.primarySourceAuthor || record.sourceAuthor,
      source ?? record.sourceShort ?? record.sourceName, collection,
      url ?? record.sourcePageUrl ?? record.url, localMetadata,
    ]),
  };
}

export function createSearchRanker(fields, readBody) {
  let title, metadata, previousBody;
  let body = '';
  return query => {
    if (query.raw && query.raw === fields.id) return Number.MAX_SAFE_INTEGER;
    if (!query.terms.length) return 0;
    title ??= normalizeSearchText(fields.title);
    metadata ??= normalizeSearchText(fields.metadata);
    let checkedBody = false;
    let score = 0;
    for (const term of query.terms) {
      if (title.includes(term)) score += 5;
      else if (metadata.includes(term)) score += 3;
      else {
        if (!readBody) return -1;
        if (!checkedBody) {
          // Local users can save a prompt without replacing the directory row.
          const current = readBody();
          if (current !== previousBody) {
            body = normalizeSearchText(current);
            previousBody = current;
          }
          checkedBody = true;
        }
        if (!body.includes(term)) return -1;
        score += 1;
      }
    }
    return score;
  };
}

export function compareComponentTitles(a, b) {
  return order.compare(a.originalName || a.name || a.title || '', b.originalName || b.name || b.title || '') ||
    order.compare(text(a.id), text(b.id));
}

/** Index the directory once for repeated selections in either host. */
export function createComponentSearch(records, {
  describe = record => ({ category: record.category, source: record.sourceName }),
} = {}) {
  const entries = [...records].sort(compareComponentTitles).map(record => ({ record, facets: describe(record) }));
  return ({ category = '', source = '', query = '' } = {}) => {
    const search = prepareSearchQuery(query);
    const matching = entries.filter(({ facets }) => (!category || facets.category === category) &&
      (!source || facets.source === source));
    if (!search.raw) return matching.map(({ record }) => record);
    return matching.map(entry => {
      const { record, facets } = entry;
      entry.rank ??= createSearchRanker(componentSearchFields(record, facets), () => record.prompt);
      return { record, score: entry.rank(search) };
    }).filter(({ score }) => score >= 0)
      .sort((a, b) => b.score - a.score)
      .map(({ record }) => record);
  };
}
