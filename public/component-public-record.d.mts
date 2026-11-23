export function publicBrowserRecord(entry: {
  id: string;
  title: string;
  originalName: string;
  description: string;
  tags: readonly string[];
  category: string;
  prompt: string;
  sourcePageUrl: string;
  sourcePageKind: string;
  sourceAuthor: string;
  sourceName: string;
  license: string;
  sourcePolicy: string;
  collectionSource?: string;
  preview: { kind: string; url: string; poster?: string; ratio?: number };
  files: readonly string[];
}, options?: { sourceRevision?: string }): Record<string, unknown>;

export function publicAssetUrl(path: string, revision?: string): string;
export function publicComponentPackageUrl(id: string, revision?: string): string;
