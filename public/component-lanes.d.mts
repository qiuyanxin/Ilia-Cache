export type ComponentCardSlots = Partial<Record<1 | 2 | 3, { column: number; row: number }>>;

export function splitComponentLanes<T>(items: readonly T[], laneCount: number): T[][];
export function planDirectoryCards<T>(items: readonly T[], limit?: number): { item: T; slots: ComponentCardSlots }[];
