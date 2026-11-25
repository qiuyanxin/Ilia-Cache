export function splitComponentLanes(items, laneCount) {
  const base = Math.floor(items.length / laneCount);
  const remainder = items.length % laneCount;
  let start = 0;
  return Array.from({ length: laneCount }, (_, index) => {
    const end = start + base + Number(index < remainder);
    const lane = items.slice(start, end);
    start = end;
    return lane;
  });
}

/** Plan server cards in the same lanes as the full interactive directory. */
export function planDirectoryCards(items, limit = items.length) {
  const cards = items.map(item => ({ item, slots: {} }));
  for (const count of [1, 2, 3]) {
    const visibleCounts = splitComponentLanes(cards.slice(0, limit), count).map(lane => lane.length);
    splitComponentLanes(cards, count).forEach((lane, column) => {
      lane.slice(0, visibleCounts[column]).forEach((card, row) => {
        card.slots[count] = { column: column + 1, row: row + 1 };
      });
    });
  }
  return cards.filter(card => Object.keys(card.slots).length);
}
