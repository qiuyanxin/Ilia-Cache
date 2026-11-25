export function createComponentPackageCache(loadPackage) {
  const entries = new Map();

  function read({ filePackage, sourceRevision }) {
    const entry = entries.get(filePackage);
    return entry && entry.revision === sourceRevision ? entry : undefined;
  }

  function load(record) {
    if (!record.filePackage || !loadPackage) return;
    const existing = read(record);
    if (existing && existing.status !== 'error') return existing;

    const entry = { revision: record.sourceRevision, status: 'loading', files: [] };
    entries.set(record.filePackage, entry);
    entry.settled = Promise.resolve()
      .then(() => loadPackage(record.filePackage, entry.revision))
      .then(pkg => {
        if (!Array.isArray(pkg?.files)) throw new Error('源码包格式无效');
        entry.files = pkg.files;
        entry.status = 'ready';
      })
      .catch(() => { entry.status = 'error'; });
    return entry;
  }

  return { read, load };
}
