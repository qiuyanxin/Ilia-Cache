import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('精选 Framer 与 21st.dev 页面保留来源、作者和使用边界', async () => {
  const library = JSON.parse(await readFile(new URL('../data/library.json', import.meta.url), 'utf8'));
  const selected = library.resources.filter((item) =>
    String(item.id).startsWith('page-framer-') || String(item.id).startsWith('page-21st-')
  );
  assert.equal(selected.length, 45);
  assert.equal(selected.filter((item) => item.sourceShort === 'Framer').length, 15);
  assert.equal(selected.filter((item) => item.sourceShort === '21st.dev').length, 30);
  assert.ok(selected.every((item) => item.primarySourceAuthor && item.primarySourceUrl));
  assert.ok(selected.every((item) => item.sourcePolicy === 'source-link-only'));
  assert.ok(selected.every((item) => item.promptKind === 'reference'));
  assert.ok(selected.every((item) => !item.filePackage && !item.sourceFiles));
  assert.equal(selected.find((item) => item.id === 'page-framer-dorok').license.startsWith('Single-Use'), true);
});
