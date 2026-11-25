const changedFields = {
  resources: '_changedResources',
  lessons: '_changedLessons',
  inbox: '_changedInbox',
  styles: '_changedStyles',
  projects: '_changedProjects'
};

function snapshot(state) {
  const groups = {};
  for (const group of Object.keys(changedFields)) {
    groups[group] = new Map((state?.[group] || []).map(row => [row.id, JSON.stringify(row)]));
  }
  return { groups, cart: JSON.stringify(state?.componentCart || []) };
}

export function createLibrarySync({ getState, initialState, send }) {
  let committed = snapshot(initialState);
  let pending = Promise.resolve();

  return {
    acknowledgeResource(record) {
      committed.groups.resources.set(record.id, JSON.stringify(record));
    },

    flush() {
      const operation = pending.then(async () => {
        const state = getState();
        const next = snapshot(state);
        const payload = { ...state, _patch: true, _cartChanged: next.cart !== committed.cart };
        for (const [group, changed] of Object.entries(changedFields)) {
          payload[changed] = [...next.groups[group]].flatMap(([id, data]) =>
            committed.groups[group].get(id) === data ? [] : [id]);
        }
        await send(JSON.stringify(payload));
        committed = next;
      });
      pending = operation.catch(() => {});
      return operation;
    }
  };
}
