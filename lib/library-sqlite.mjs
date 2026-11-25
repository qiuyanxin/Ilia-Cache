import { closeSync, lstatSync, mkdirSync, openSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { searchDocument } from './catalog-search.mjs';
import { groupSites } from '../public/catalog.mjs';
import { componentCategory, isComponentRecord, isSoundEffect, sourceName } from '../public/component-taxonomy.mjs';
import { isPageRecord } from '../public/page-taxonomy.mjs';

const schemaVersion = 1;
const schema = `
  CREATE TABLE library_state (
    id INTEGER PRIMARY KEY CHECK (id = 1)
  ) STRICT;
  CREATE TABLE library_settings (
    field TEXT PRIMARY KEY,
    position INTEGER NOT NULL,
    is_collection INTEGER NOT NULL CHECK (is_collection IN (0, 1)),
    value TEXT,
    CHECK ((is_collection = 1 AND value IS NULL) OR
      (is_collection = 0 AND value IS NOT NULL AND json_valid(value)))
  ) STRICT;
  CREATE TABLE library_records (
    field TEXT NOT NULL REFERENCES library_settings (field) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    record_id TEXT,
    payload TEXT NOT NULL CHECK (json_valid(payload)),
    PRIMARY KEY (field, position)
  ) STRICT;
  CREATE INDEX library_records_id ON library_records (field, record_id);
  CREATE TABLE library_search (
    rowid INTEGER PRIMARY KEY,
    kind TEXT NOT NULL,
    record_id TEXT NOT NULL,
    category TEXT NOT NULL,
    source TEXT NOT NULL,
    archived INTEGER NOT NULL,
    payload TEXT NOT NULL CHECK (json_valid(payload)),
    UNIQUE (kind, record_id)
  ) STRICT;
  CREATE INDEX library_search_category ON library_search (category);
  CREATE INDEX library_search_record_id ON library_search (record_id);
  CREATE VIRTUAL TABLE library_fts USING fts5(terms, tokenize = 'unicode61 remove_diacritics 0');
  PRAGMA user_version = 1;
`;
const listKinds = {
  styles: 'style', customFonts: 'font', lessons: 'lesson', inbox: 'capture',
  projects: 'project', pinterestBoards: 'pinterest_board',
};
const searchFields = [
  'name', 'title', 'displayTitle', 'originalName', 'english', 'description', 'note',
  'finds', 'sourceAuthor', 'primarySourceAuthor', 'sourceShort', 'sourcePolicy',
  'searchAliases', 'tags', 'evidence', 'detailPath', 'path', 'archived',
];
const array = value => Array.isArray(value) ? value : [];
const folded = value => typeof value === 'string' ? value.trim().normalize('NFKC').toLowerCase() : '';
const directoryPath = directory => directory instanceof URL ? fileURLToPath(directory) : directory;

export function libraryDatabasePath(directory) {
  return join(directoryPath(directory), 'library.sqlite');
}

function openReadOnly(directory) {
  const file = libraryDatabasePath(directory);
  try {
    const entry = lstatSync(file);
    if (!entry.isFile()) throw new Error('本机资料库数据库必须是普通文件。');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  const database = new DatabaseSync(file, { readOnly: true });
  database.exec('PRAGMA busy_timeout = 200');
  database.exec('BEGIN');
  return database;
}

function readSchema(database) {
  const version = database.prepare('PRAGMA user_version').get().user_version;
  if (version !== 0 && version !== schemaVersion) throw new Error('本机资料库数据库版本不受支持。');
  return version;
}

function snapshot(database) {
  if (!database.prepare('SELECT 1 FROM library_state').get()) return null;
  const state = Object.fromEntries(database.prepare(`
    SELECT field, is_collection, value FROM library_settings ORDER BY position
  `).all().map(row => [row.field, row.is_collection ? [] : JSON.parse(row.value)]));
  for (const row of database.prepare('SELECT field, payload FROM library_records ORDER BY field, position').all()) {
    state[row.field].push(JSON.parse(row.payload));
  }
  return state;
}

export function readStoredLibrary(directory) {
  const database = openReadOnly(directory);
  if (!database) return null;
  try {
    return readSchema(database) ? snapshot(database) : null;
  } finally {
    database.close();
  }
}

function searchRecords(library) {
  const records = new Map();
  function add(kind, record, id = record.id) {
    if (typeof id !== 'string' || !id) return;
    const data = { id, kind };
    for (const field of searchFields) if (Object.hasOwn(record, field)) data[field] = record[field];
    data.category = kind === 'component' || kind === 'sound' ? componentCategory(record) :
      record.pageCategory || record.category || record.group || '';
    data.sourceName = record.sourceName || record.sourceShort ||
      (kind === 'component' || kind === 'sound' ? sourceName(record) : (record.source || ''));
    if (kind === 'lesson' && !data.description) data.description = record.explanation || record.prompt;
    if (kind === 'capture' && !data.description) data.description = record.text;
    if (kind === 'font' && array(library.removedFontIds).includes(id)) data.archived = true;
    records.set(kind + '\0' + id, data);
  }
  const websites = [];
  for (const record of array(library.resources)) {
    if (!record || typeof record !== 'object') continue;
    if (isComponentRecord(record, { includeArchived: true })) {
      add('component', record);
      if (isSoundEffect({ ...record, archived: false })) add('sound', record);
    } else if (isPageRecord(record, { includeArchived: true })) {
      add('page', record);
    } else {
      add('resource', record);
      websites.push(record);
    }
  }
  for (const website of groupSites(websites)) {
    add('website', { ...website, ...library.siteOverrides?.[website.domain], id: website.id });
  }
  for (const [field, kind] of Object.entries(listKinds)) {
    for (const [index, record] of array(library[field]).entries()) {
      if (record && typeof record === 'object') add(kind, record, record.id || field + '-' + (index + 1));
    }
  }
  add('library_settings', { id: 'library-settings', name: '本机资料库设置' });
  return records;
}

function updateSearch(database, library) {
  const existing = new Map(database.prepare('SELECT rowid, kind, record_id, payload FROM library_search').all()
    .map(row => [row.kind + '\0' + row.record_id, row]));
  const eraseIndex = database.prepare('DELETE FROM library_fts WHERE rowid = ?');
  const eraseRecord = database.prepare('DELETE FROM library_search WHERE rowid = ?');
  const insertRecord = database.prepare(`
    INSERT INTO library_search (kind, record_id, category, source, archived, payload)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertIndex = database.prepare('INSERT INTO library_fts (rowid, terms) VALUES (?, ?)');
  function erase(row) {
    eraseIndex.run(row.rowid);
    eraseRecord.run(row.rowid);
  }
  for (const [key, record] of searchRecords(library)) {
    const payload = JSON.stringify(record);
    const previous = existing.get(key);
    existing.delete(key);
    if (previous?.payload === payload) continue;
    if (previous) erase(previous);
    const document = searchDocument(record);
    const { lastInsertRowid } = insertRecord.run(record.kind, record.id, folded(record.category),
      folded(record.sourceName), Number(Boolean(record.archived)), payload);
    insertIndex.run(lastInsertRowid, document.terms.join(' '));
  }
  for (const obsolete of existing.values()) erase(obsolete);
}

function saveSnapshot(database, library) {
  const fields = new Set(database.prepare('SELECT field FROM library_settings').all().map(row => row.field));
  const upsertSetting = database.prepare(`
    INSERT INTO library_settings (field, position, is_collection, value) VALUES (?, ?, ?, ?)
    ON CONFLICT (field) DO UPDATE SET position = excluded.position,
      is_collection = excluded.is_collection, value = excluded.value
    WHERE position != excluded.position OR is_collection != excluded.is_collection OR value IS NOT excluded.value
  `);
  const upsertRecord = database.prepare(`
    INSERT INTO library_records (field, position, record_id, payload) VALUES (?, ?, ?, ?)
    ON CONFLICT (field, position) DO UPDATE SET record_id = excluded.record_id, payload = excluded.payload
    WHERE record_id IS NOT excluded.record_id OR payload != excluded.payload
  `);
  const trimRecords = database.prepare('DELETE FROM library_records WHERE field = ? AND position >= ?');
  const removeSetting = database.prepare('DELETE FROM library_settings WHERE field = ?');
  for (const [position, [field, value]] of Object.entries(library).entries()) {
    if (value === undefined) continue;
    const isCollection = Array.isArray(value);
    fields.delete(field);
    upsertSetting.run(field, position, Number(isCollection), isCollection ? null : JSON.stringify(value));
    if (isCollection) {
      for (const [index, record] of value.entries()) {
        const id = typeof record?.id === 'string' ? record.id : typeof record === 'string' ? record : null;
        upsertRecord.run(field, index, id, JSON.stringify(record ?? null));
      }
    }
    trimRecords.run(field, isCollection ? value.length : 0);
  }
  for (const obsolete of fields) removeSetting.run(obsolete);
  updateSearch(database, library);
  database.exec('INSERT OR IGNORE INTO library_state (id) VALUES (1)');
}

async function retryLocked(operation) {
  const deadline = Date.now() + 10_000;
  for (;;) {
    try {
      return operation();
    } catch (error) {
      if (![5, 6].includes(error.errcode & 255) || Date.now() >= deadline) throw error;
      await setTimeout(50);
    }
  }
}

export async function withLibraryWrite(directory, operation) {
  mkdirSync(directoryPath(directory), { recursive: true, mode: 0o700 });
  const file = libraryDatabasePath(directory);
  try {
    closeSync(openSync(file, 'wx', 0o600));
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  // A pre-existing symbolic link must never become the target of a library save.
  if (!lstatSync(file).isFile()) throw new Error('本机资料库数据库必须是普通文件。');
  const database = new DatabaseSync(file);
  try {
    database.exec('PRAGMA foreign_keys = ON');
    await retryLocked(() => database.exec('BEGIN IMMEDIATE'));
    try {
      if (!readSchema(database)) database.exec(schema);
      const result = await operation(snapshot(database), library => saveSnapshot(database, library));
      await retryLocked(() => database.exec('COMMIT'));
      return result;
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  } finally {
    database.close();
  }
}

export function findStoredLibraryCandidates(directory, { terms = [], kind, id, category, source,
  limit, includeArchived = false } = {}) {
  const database = openReadOnly(directory);
  if (!database) return null;
  try {
    if (!readSchema(database) || !database.prepare('SELECT 1 FROM library_state').get()) return null;
    const match = terms.filter(term => /^[\p{L}\p{N}]+$/u.test(term)).slice(0, 32)
      .map(term => '"' + term + '"').join(' OR ');
    const where = [];
    const bindings = [];
    if (match) {
      where.push('library_fts MATCH ?');
      bindings.push(match);
    }
    for (const [column, value] of Object.entries({ kind, record_id: id, category: folded(category), source: folded(source) })) {
      if (!value) continue;
      where.push('item.' + column + ' = ?');
      bindings.push(value);
    }
    if (!includeArchived) where.push('item.archived = 0');
    const conditions = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const joinIndex = match ? 'JOIN library_fts ON library_fts.rowid = item.rowid' : '';
    const order = match ? 'bm25(library_fts), item.kind, item.record_id' : 'item.kind, item.record_id';
    return database.prepare(`
      SELECT item.payload FROM library_search AS item ${joinIndex} ${conditions} ORDER BY ${order} LIMIT ?
    `).all(...bindings, Number.isSafeInteger(limit) && limit > 0 ? limit : -1).map(row => JSON.parse(row.payload));
  } finally {
    database.close();
  }
}

export function checkLibraryDatabase(directory) {
  const database = openReadOnly(directory);
  if (!database) throw new Error('找不到本机资料库数据库。');
  try {
    const validation = database.prepare('PRAGMA quick_check').all();
    if (validation.length !== 1 || validation[0].quick_check !== 'ok' || !readSchema(database)) {
      throw new Error('本机资料库数据库校验失败。');
    }
    return snapshot(database);
  } finally {
    database.close();
  }
}
