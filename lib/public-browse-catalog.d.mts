export interface PublicWebsiteRecord {
  id: string;
  domain: string;
  title: string;
  url: string;
  category: string;
  tags: string[];
  description: string;
  finds: string;
  use: string;
  gets: string;
  cost: string;
  created: string;
  verification: { sourceUrl: string; checkedAt: string; note: string } | null;
  links: { id: string; title: string; url: string }[];
}

export interface PublicPageRecord {
  id: string;
  title: string;
  originalName: string;
  url: string;
  category: string;
  sourceCategory: string;
  description: string;
  tags: string[];
  sourceName: string;
  sourceAuthor: string;
  collectionSource: string;
  sourcePageUrl: string;
  sourcePageKind: 'primary' | 'collection' | 'unresolved';
  access: string;
  license: string;
  promptKind: 'original' | 'implementation-task' | null;
}

export function buildPublicBrowseCatalog(seed: unknown, siteSummaries: unknown): {
  version: 1;
  websites: PublicWebsiteRecord[];
  pages: PublicPageRecord[];
};
