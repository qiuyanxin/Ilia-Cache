import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLibrarySync } from '../public/library-sync.mjs';

test('同步失败后，下一次保存会重送尚未确认的记录', async () => {
  let state = { resources: [{ id: 'a', name: '第一次修改' }], lessons: [] };
  const requests = [];
  const sync = createLibrarySync({
    getState: () => state,
    initialState: { resources: [{ id: 'a', name: '磁盘原值' }] },
    send: async body => {
      requests.push(JSON.parse(body));
      if (requests.length === 1) throw new Error('offline');
    }
  });

  await assert.rejects(sync.flush(), /offline/);
  state = { ...state, lessons: [{ id: 'next' }] };
  await sync.flush();
  await sync.flush();
  assert.deepEqual(requests.map(request => request._changedResources), [['a'], ['a'], []]);
  assert.deepEqual(requests.map(request => request._changedLessons), [[], ['next'], []]);
});

test('重开网页从磁盘基线补同步，已由组件提交接口确认的记录不再重复写入', async () => {
  const saved = { id: 'direct', name: '组件保存接口已经确认' };
  const state = { resources: [{ id: 'a', name: '浏览器里的更新' }, saved], lessons: [] };
  const requests = [];
  const sync = createLibrarySync({
    getState: () => state,
    initialState: { resources: [{ id: 'a', name: '磁盘原值' }] },
    send: async body => { requests.push(JSON.parse(body)); }
  });

  sync.acknowledgeResource(saved);
  await sync.flush();
  assert.deepEqual(requests[0]._changedResources, ['a']);
});
