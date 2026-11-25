import { splitComponentLanes } from './component-lanes.mjs';

function firstVisibleCard(column) {
  const cards = column.children;
  let start = 0;
  let end = cards.length;
  while (start < end) {
    const index = Math.floor((start + end) / 2);
    if (cards[index].getBoundingClientRect().bottom <= 0) start = index + 1;
    else end = index;
  }
  return cards[start];
}

/** Lay out the cards and keep a visible card in place when responsive CSS changes the lane count. */
export function installComponentLaneLayout(grid) {
  const laneCount = () => Number(getComputedStyle(grid).getPropertyValue('--component-lanes')) || 1;
  let lanes = laneCount();
  let anchor;
  let captureFrame = 0;
  const columns = [];
  const newLane = () => {
    const column = document.createElement('div');
    column.className = 'component-lane';
    return column;
  };

  function layout(tiles) {
    scheduleAnchor();
    if (!tiles.length) {
      if (columns.length) grid.replaceChildren();
      columns.length = 0;
      return;
    }
    const groups = splitComponentLanes(tiles, lanes);
    if (!columns.length) {
      for (const group of groups) {
        const column = newLane();
        column.append(...group);
        columns.push(column);
      }
      grid.replaceChildren(...columns);
      return;
    }
    const focused = grid.contains(document.activeElement) ? document.activeElement : null;
    const remaining = new Set(tiles);
    for (const column of columns) {
      for (const tile of [...column.children]) if (!remaining.has(tile)) tile.remove();
    }
    while (columns.length < lanes) {
      const column = newLane();
      columns.push(column);
      grid.append(column);
    }
    groups.forEach((group, lane) => {
      const column = columns[lane];
      group.forEach((tile, index) => {
        const current = column.children[index];
        if (current !== tile) column.insertBefore(tile, current || null);
      });
    });
    for (const extra of columns.splice(lanes)) extra.remove();
    if (focused?.isConnected && document.activeElement !== focused) focused.focus({ preventScroll: true });
  }

  function scheduleAnchor() {
    if (captureFrame) return;
    captureFrame = requestAnimationFrame(() => {
      captureFrame = 0;
      anchor = undefined;
      if (!window.scrollY || !grid.getClientRects().length) return;
      const focused = document.activeElement;
      if (grid.contains(focused) && focused.closest('.component-tile')) {
        const bounds = focused.getBoundingClientRect();
        if (bounds.bottom > 0 && bounds.top < innerHeight) {
          anchor = { node: focused, top: bounds.top };
          return;
        }
      }
      for (const column of columns) {
        const card = firstVisibleCard(column);
        const bounds = card?.getBoundingClientRect();
        if (bounds && bounds.top < innerHeight) {
          anchor = { node: card, top: bounds.top };
          return;
        }
      }
    });
  }

  function updateLanes() {
    const next = laneCount();
    if (next === lanes) {
      scheduleAnchor();
      return;
    }
    const saved = anchor;
    lanes = next;
    layout([...grid.querySelectorAll('.component-tile')]);
    if (saved && grid.contains(saved.node) && grid.getClientRects().length) {
      const bounds = saved.node.getBoundingClientRect();
      const top = Math.max(saved.top, 1 - bounds.height);
      window.scrollBy({ top: bounds.top - top, behavior: 'instant' });
    }
  }
  window.addEventListener('resize', updateLanes);
  window.addEventListener('scroll', scheduleAnchor, { passive: true });
  grid.addEventListener('focusin', scheduleAnchor);
  return layout;
}
