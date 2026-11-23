export interface PageReference {
  id: string;
  name: string;
  originalName?: string;
  pageCategory?: string;
  sourceCategory?: string;
  sourceShort?: string;
  source?: string;
  collectionSource?: { name?: string };
  prompt?: string;
  promptKind?: string | null;
}

export interface PageReferenceFilters {
  category?: string;
  source?: string;
  query?: string;
}

export const PAGE_CATEGORIES: readonly string[];
export function pageCategory(item: PageReference): string;
export function pageSource(item: PageReference): string;
export function pagePromptLabel(item: PageReference): string;
export function mixPageSources<T extends PageReference>(items: T[]): T[];
export function filterPageReferences<T extends PageReference>(items: T[], filters?: PageReferenceFilters): T[];
export function renderPageSourcePreview(): string;
export function renderPageReferenceCards<T extends PageReference>(items: T[], options: {
  preview: (item: T) => string;
  actions?: (item: T) => string;
}): string;
export function renderPageLibrary(items: PageReference[], options?: PageReferenceFilters & {
  canAdd?: boolean;
  cards?: string;
}): string;
export function sizePageReferences(grid: Element): ResizeObserver | undefined;
