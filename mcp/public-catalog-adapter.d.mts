import type { SearchDocument } from '../lib/catalog-search.mjs';
type ResourceRecord = Record<string, unknown>;
type CatalogSnapshot = {
  version: string | number;
  components: readonly ResourceRecord[];
  topics?: readonly { path: string; examples: string[]; [key: string]: unknown }[];
};
type CandidateInput = { terms: string[]; id: string; kind?: string; category?: string; source?: string; limit: number };
type LookupResult = { version: string | number; resource: { record: ResourceRecord; document?: SearchDocument } };
type FileResult = { version: string | number; file: { content: string } };
type Awaitable<T> = T | Promise<T>;
export function websiteOrigin(value?: string): string;
export function createPublishedCatalog(config: {
  baseUrl?: string;
  snapshot(): Awaitable<CatalogSnapshot>;
  retrieve(input: CandidateInput): Awaitable<{ version: string | number; candidates: SearchDocument[] }>;
  lookup(kind: string, id: string): Awaitable<LookupResult | null | undefined>;
  readFile(kind: string, id: string, name: string): Awaitable<FileResult | null | undefined>;
}): object;
