import test from 'node:test';
import assert from 'node:assert/strict';
import { createComponentPackageCache } from '../public/component-package-cache.mjs';

const record = { filePackage: 'sample', sourceRevision: 'first' };
const first = { files: [{ name: 'first.html', content: '<p>First</p>' }] };
const second = { files: [{ name: 'second.html', content: '<p>Second</p>' }] };

test('reopening a package shares the in-flight request and the completed files', async () => {
  let calls = 0;
  const pending = Promise.withResolvers();
  const cache = createComponentPackageCache((id, revision) => {
    assert.equal(id, record.filePackage);
    assert.equal(revision, record.sourceRevision);
    calls++;
    return pending.promise;
  });

  const entry = cache.load(record);
  assert.equal(entry.status, 'loading');
  assert.equal(cache.load({ ...record }), entry);
  pending.resolve(first);
  await entry.settled;

  assert.equal(entry.status, 'ready');
  assert.equal(cache.load(record), entry);
  assert.deepEqual(cache.read(record).files, first.files);
  assert.equal(calls, 1);
});

test('a failed package can be retried and a valid empty package remains ready', async () => {
  let calls = 0;
  const cache = createComponentPackageCache(() => {
    calls++;
    return calls === 1 ? Promise.reject(new Error('unavailable')) : { files: [] };
  });
  const failure = cache.load(record);
  await failure.settled;
  assert.equal(cache.read(record).status, 'error');

  const retry = cache.load(record);
  await retry.settled;
  assert.equal(retry.status, 'ready');
  assert.deepEqual(retry.files, []);
  assert.equal(cache.load(record), retry);
  assert.equal(calls, 2);
});

test('an older revision completing later cannot replace the current files', async () => {
  const pending = Promise.withResolvers();
  const responses = [pending.promise, second];
  const cache = createComponentPackageCache(() => responses.shift());
  const revised = { ...record, sourceRevision: 'second' };
  const olderEntry = cache.load(record);
  const currentEntry = cache.load(revised);
  await currentEntry.settled;
  pending.resolve(first);
  await olderEntry.settled;

  assert.equal(cache.read(record), undefined);
  assert.equal(cache.read(revised), currentEntry);
  assert.deepEqual(cache.read(revised).files, second.files);
});
