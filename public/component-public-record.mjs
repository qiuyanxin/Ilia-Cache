/** Convert an already approved catalog entry into the browser's readonly record. */
export function publicBrowserRecord(entry, { sourceRevision } = {}) {
  return {
    id: entry.id, name: entry.title, originalName: entry.originalName,
    description: entry.description, tags: entry.tags, componentCategory: entry.category,
    caseType: '组件', category: '组件', kind: '案例', prompt: entry.prompt,
    url: entry.sourcePageUrl, sourcePageUrl: entry.sourcePageUrl, sourcePageKind: entry.sourcePageKind,
    primarySourceAuthor: entry.sourceAuthor, sourceShort: entry.sourceName,
    license: entry.license, sourcePolicy: entry.sourcePolicy, catalogPreview: entry.preview,
    ...(entry.collectionSource ? { collectionSource: { name: entry.collectionSource } } : {}),
    ...(entry.preview.kind === 'video' ? { previewVideo: entry.preview.url, previewPoster: entry.preview.poster } : {}),
    ...(entry.preview.kind === 'image' ? {
      referencePreview: { kind: 'image', url: entry.preview.url, sourcePageUrl: entry.sourcePageUrl, ratio: entry.preview.ratio },
    } : {}),
    ...(entry.files.length ? { filePackage: entry.id, sourceFileNames: entry.files } : {}),
    ...(entry.files.length && sourceRevision ? { sourceRevision } : {}),
  };
}

export function publicAssetUrl(path, revision) {
  return /^[a-f0-9]{64}$/.test(revision) ? path + '?v=' + revision : path;
}

export function publicComponentPackageUrl(id, revision) {
  return typeof id === 'string' && /^[a-z0-9][a-z0-9_-]{0,120}$/.test(id)
    ? publicAssetUrl('/ilia-ui/packages/' + id + '.json', revision) : '';
}
