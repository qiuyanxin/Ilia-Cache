import { libraryDirectory as dir } from './library-location.mjs';
import { readLibraryFile, writeLibraryFile } from './library-files.mjs';
import { updateComponentIndex } from './library-index.mjs';

export { writeLibraryFile } from './library-files.mjs';

const libraryFile = new URL('library.json', dir);
const storedComponentFields = [
  'componentRevision', 'sourceRevision', 'captureMethod', 'framework', 'filePackage',
  'sourceFiles', 'files', 'preview', 'previewStatus', 'previewCandidates', 'referencePreview',
  'sourcePolicy', 'sourcePageUrl', 'sourcePageKind', 'promptHistory'
];

export async function loadLibrary() {
  const content = await readLibraryFile(libraryFile);
  return content === null ? null : JSON.parse(content);
}

function mergeRows(previous = [], incoming = [], changedIds, mergeRecord) {
  const changed = new Set(changedIds || []);
  const next = new Map(incoming.filter(row => changed.has(row.id)).map(row => [row.id, row]));
  const result = previous.map(row => {
    const update = next.get(row.id);
    next.delete(row.id);
    return update ? (mergeRecord ? mergeRecord(row, update) : update) : row;
  });
  return [...result, ...next.values()];
}

function preserveComponentChanges(previous, incoming) {
  if (!previous.componentRevision) return incoming;
  const result = { ...incoming };
  if (previous.componentRevision !== incoming.componentRevision) {
    for (const field of ['name', 'url', 'category', 'componentCategory', 'prompt', 'sourceUrl',
      'license', 'originalUrl', 'primarySourceAuthor', 'primarySourceUrl']) {
      if (Object.hasOwn(previous, field)) result[field] = previous[field];
      else delete result[field];
    }
  }
  for (const field of storedComponentFields) {
    if (Object.hasOwn(previous, field)) result[field] = previous[field];
    else delete result[field];
  }
  return result;
}

let pending = Promise.resolve();

function queueLibraryOperation(operation) {
  const next = pending.then(operation);
  pending = next.catch(() => {});
  return next;
}

export function updateLibrary(change) {
  return queueLibraryOperation(async () => {
    const previous = await loadLibrary();
    const state = previous || { resources: [], lessons: [] };
    const { next, result } = await change(state);
    if (!next) return result;
    next.updatedAt = new Date().toISOString();
    await writeLibraryFile(libraryFile, JSON.stringify(next, null, 2));
    try {
      await updateComponentIndex(next, previous);
    } catch (error) {
      console.warn('资料已保存，组件索引更新失败：', error.code || error.message);
    }
    return result;
  });
}

export function rebuildComponentIndex() {
  return queueLibraryOperation(async () => {
    const library = await loadLibrary();
    if (!library) return false;
    await updateComponentIndex(library, null, { rebuild: true });
    return true;
  });
}

export function saveLibrary(incoming) {
  return updateLibrary(previous => {
    const next = { ...incoming };
    if (incoming._patch) {
      Object.assign(next, previous, incoming, {
        resources: mergeRows(previous.resources, incoming.resources,
          incoming._changedResources, preserveComponentChanges),
        lessons: mergeRows(previous.lessons, incoming.lessons, incoming._changedLessons),
        inbox: mergeRows(previous.inbox, incoming.inbox, incoming._changedInbox),
        styles: mergeRows(previous.styles, incoming.styles, incoming._changedStyles),
        projects: mergeRows(previous.projects, incoming.projects, incoming._changedProjects),
        componentCart: incoming._cartChanged ? incoming.componentCart : previous.componentCart || [],
        siteOverrides: { ...previous.siteOverrides, ...incoming.siteOverrides }
      });
      if (!previous.updatedAt) {
        next.resources = incoming.resources;
        next.lessons = incoming.lessons;
      }
    } else {
      const rows = new Map(previous.resources.filter(row => row.componentRevision).map(row => [row.id, row]));
      next.resources = incoming.resources.map(row => {
        const existing = rows.get(row.id);
        rows.delete(row.id);
        return existing ? preserveComponentChanges(existing, row) : row;
      });
      next.resources.push(...rows.values());
    }
    for (const field of ['_patch', '_cartChanged', '_changedResources', '_changedLessons',
      '_changedInbox', '_changedStyles', '_changedProjects']) delete next[field];
    return { next };
  });
}

export function zipFiles(files){const chunks=[],central=[];let offset=0;const crc=b=>{let c=0xffffffff;for(const byte of b){c^=byte;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};for(const f of files){const name=Buffer.from(f.name),body=Buffer.from(f.content),check=crc(body),h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(0x800,6);h.writeUInt32LE(check,14);h.writeUInt32LE(body.length,18);h.writeUInt32LE(body.length,22);h.writeUInt16LE(name.length,26);chunks.push(h,name,body);const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt32LE(check,16);c.writeUInt32LE(body.length,20);c.writeUInt32LE(body.length,24);c.writeUInt16LE(name.length,28);c.writeUInt32LE(offset,42);central.push(c,name);offset+=h.length+name.length+body.length;}const cent=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(cent.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...chunks,cent,end]);}
