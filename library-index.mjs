import { createHash } from 'node:crypto';
import { access } from 'node:fs/promises';
import { basename } from 'node:path';
import { libraryDirectory } from './library-location.mjs';
import { readLibraryFile, writeLibraryFile } from './library-files.mjs';
import { isComponentRecord } from './public/component-taxonomy.mjs';

const indexFile = new URL('component-index.json', libraryDirectory);
const revisionFile = new URL('component-index.revision', libraryDirectory);

function indexRows(library) {
  return (library?.resources || []).filter(row => isComponentRecord(row) && typeof row.id === 'string');
}

function fingerprint(rows) {
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

export async function updateComponentIndex(library, previous, { rebuild = false } = {}) {
  const rows = indexRows(library);
  const previousRows = indexRows(previous);
  const revision = fingerprint(rows);
  const onDisk = await readLibraryFile(revisionFile);
  const knownRevision = onDisk?.trim();
  const hasIndex = await exists(indexFile);
  if (!rebuild && hasIndex && knownRevision === revision) return;

  // Only skip individual manifests when the previous run completed every write.
  const consistent = !rebuild && hasIndex && knownRevision === fingerprint(previousRows);
  const oldRows = new Map(consistent ? previousRows.map(row => [row.id, row]) : []);
  const index = [];
  for (const row of rows) {
    const id = row.id.replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!id) continue;
    const directory = new URL('components/' + id + '/', libraryDirectory);
    const manifest = {
      ...row,
      files: row.sourceFiles || (row.files || []).map(file => ({ name: file.name })),
      folder: 'data/components/' + id
    };
    index.push(manifest);
    if (JSON.stringify(oldRows.get(row.id)) === JSON.stringify(row)) continue;
    for (const file of row.files || []) {
      if (typeof file.name !== 'string' || typeof file.content !== 'string') continue;
      const name = basename(file.name);
      if (!name || name === '.' || name === '..') continue;
      await writeLibraryFile(new URL(encodeURIComponent(name), directory), file.content);
    }
    await writeLibraryFile(new URL('PROMPT.md', directory), row.prompt || '尚未补充提示词');
    await writeLibraryFile(new URL('manifest.json', directory), JSON.stringify(manifest, null, 2));
  }
  await writeLibraryFile(indexFile, JSON.stringify(index, null, 2));
  await writeLibraryFile(revisionFile, revision + '\n');
}
