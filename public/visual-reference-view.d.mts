interface ReferenceRecord {
  id: string;
  originalName?: string;
  componentCategory?: string;
  tags?: string[];
}

export const VISUAL_REFERENCE_TABS: readonly string[];
export function referencesByStyle(styles: { id: string; english?: string }[], references: ReferenceRecord[]): Map<string, string>;
export function renderVisualReferenceTabs(active: string, styleCount: number, references: ReferenceRecord[], linkFor?: (label: string) => string): string;
export function describeVisualReferences<T extends ReferenceRecord>(references: T[]): (T & {
  referenceGroup: string;
  referenceCategory: string;
})[];
