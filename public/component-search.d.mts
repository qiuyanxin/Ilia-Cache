export const COMPONENT_CATEGORIES: readonly string[];

export interface ComponentSearchFilters {
  category?: string;
  source?: string;
  query?: string;
}

export function createComponentSearch<T extends { id: string }>(
  records: readonly T[],
  options?: { describe?: (record: T) => Pick<ComponentSearchFilters, 'category' | 'source'> & { url?: string; localMetadata?: string } },
): (filters?: ComponentSearchFilters) => T[];
