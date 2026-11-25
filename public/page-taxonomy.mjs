export function isPageRecord(record, { includeArchived = false } = {}) {
  return Boolean(record && (includeArchived || !record.archived) &&
    (record.caseType === '网页参考' || record.pageCategory));
}
