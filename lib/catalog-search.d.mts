export type FactName = 'framework' | 'keyboard' | 'reusableCode' | 'reducedMotion';
export type SearchRequest = {
  intent: string;
  kind?: string;
  category?: string;
  source?: string;
  required?: Partial<{ framework: string; keyboard: boolean; reusableCode: boolean; reducedMotion: boolean }>;
  preferences?: string[];
  limit?: number;
};
export type SearchDocument = {
  id: string;
  kind: string;
  title: string;
  originalName: string;
  category: string;
  sourceName: string;
  description: string;
  terms: string[];
  titleTerms: string[];
  evidence: Partial<Record<FactName, { value: boolean | string[]; source: string }>>;
  sourcePolicy: string;
  detailPath: string;
};
export type SearchHit = Pick<SearchDocument, 'id' | 'kind' | 'title' | 'category' | 'description' | 'sourcePolicy' | 'detailPath'> & {
  evidence: Partial<Record<FactName, 'verified' | 'not_met' | 'unknown'>>;
  matchedTerms: string[];
};
export const searchKinds: readonly string[];
export function searchTerms(intent: string): string[];
export function searchDocument(record: Record<string, unknown> & { id: string }): SearchDocument;
export function searchCatalog(data: { version: string | number; candidates: SearchDocument[] }, request: SearchRequest): {
  releaseId: string;
  eligible: SearchHit[];
  nearMatches: SearchHit[];
  total: number;
};
