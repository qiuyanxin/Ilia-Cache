export interface ComponentBrowseFilters {
  query?: string;
  category?: string;
  subcategory?: string;
  source?: string;
}

interface ComponentBrowseRecord {
  id: string;
  name: string;
  componentCategory?: string;
  sourceShort?: string;
}

export interface ComponentBrowseFacets {
  categoryCounts: Record<string, number>;
  subcategoryCounts: Record<string, number>;
  sources: string[];
}

export function appearsInComponentBrowse(record: ComponentBrowseRecord): boolean;
export function describeComponentBrowse(records: readonly ComponentBrowseRecord[]): ComponentBrowseFacets;
export function browseComponentRecords<T extends ComponentBrowseRecord>(
  records: readonly T[], filters?: ComponentBrowseFilters, options?: { fuzzyFallback?: boolean },
): T[];
