const escape = value => String(value ?? '').replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

export function renderComponentProvenance({ author, license }) {
  const shownLicense = license && license !== 'unknown';
  if (!author && !shownLicense) return '';
  return `<dl class="component-provenance">${author ? `<div><dt>作者</dt><dd>${escape(author)}</dd></div>` : ''}${
    shownLicense ? `<div><dt>许可</dt><dd>${escape(license)}</dd></div>` : ''}</dl>`;
}

export function renderComponentReferences({ source, author, license, media = '', citation }) {
  const origin = source ? `<div class="component-reference-actions"><a data-reference-origin href="${escape(source.href)}" target="_blank" rel="noopener noreferrer">${escape(source.label)}</a></div>` : '';
  const credit = media && citation && citation !== source?.href
    ? `<a class="component-reference-citation" href="${escape(citation)}" target="_blank" rel="noopener noreferrer">素材出处 ↗</a>` : '';
  return `<section class="component-references" aria-label="来源与参考素材">
    ${origin}${renderComponentProvenance({ author, license })}${media}${credit}
  </section>`;
}

export function renderComponentPrompt({ value, editable = false, interactive = false }) {
  const input = interactive ? ' id="saved-component-prompt"' : '';
  const readOnly = editable ? '' : ' readonly';
  const placeholder = editable ? '把原站提供的提示词粘贴在这里。' : '来源未收录提示词。';
  const copy = interactive ? '<button type="button" id="copy-component-prompt">复制提示词</button>' : '';
  return `<div class="component-prompt">
    <label>提示词原文<textarea${input} class="command-field" data-detail-prompt rows="14"${readOnly} placeholder="${placeholder}">
${escape(value)}</textarea></label>
    <div class="component-prompt-actions">${copy}</div>
  </div>`;
}

/** Render the detail heading and actions for an interactive dialog or a linked page. */
export function renderComponentDetailChrome({ title, category, description, headingId, source, back, author, license }) {
  const heading = back ? 'h1' : 'h2';
  const summary = description?.trim();
  const dismiss = back
    ? `<a class="component-detail-dismiss" href="${escape(back)}" aria-label="返回组件库" title="返回组件库">×</a>`
    : '<button type="button" data-close aria-label="关闭组件详情">×</button>';
  const origin = source
    ? `<a data-component-origin href="${escape(source.href)}" target="_blank" rel="noopener noreferrer">${escape(source.label)}</a>`
    : '';
  const credit = author && license ? `<small>${escape(author)} · ${escape(license)}</small>` : '';
  return `<div class="dialog-heading component-detail-heading"><div><small>${escape(category)}</small><${heading} id="${escape(headingId)}">${escape(title)}</${heading}>${credit}</div>${dismiss}</div>
    ${summary ? `<p class="component-detail-note">${escape(summary)}</p>` : ''}
    <div class="component-detail-actions"><div class="component-shared-actions">${origin}${back ? '' : '<button type="button" id="copy-agent">复制给 Agent</button>'}</div></div>`;
}
