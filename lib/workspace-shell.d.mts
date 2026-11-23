export type WorkspaceShellMeta =
  | { name: string; property?: never; content: string }
  | { property: string; name?: never; content: string };

export interface WorkspaceShellHead {
  title: string;
  description?: string;
  canonical?: string;
  meta?: readonly WorkspaceShellMeta[];
}

export type WorkspaceDetailPreview =
  | { kind: 'motion'; poster: string; ratio: number }
  | { kind: 'image'; url: string; ratio?: number }
  | { kind: 'video'; url: string; poster?: string }
  | { kind: 'frame'; url: string }
  | { kind: 'sound'; url?: string }
  | { kind: 'source'; label: string };

export interface WorkspaceShellFallback {
  id?: string;
  title: string;
  /** Markup from a shared renderer that escapes all catalog fields. */
  trustedMarkup?: string;
  description?: string;
  image?: { src: string; alt: string };
  filters?: {
    action: string;
    query: string;
    category: string;
    source: string;
    categories: readonly string[];
    sources: readonly string[];
    categoryCounts?: Readonly<Record<string, number>>;
    hideCategories?: boolean;
  };
  links?: readonly { href: string; label: string; external?: boolean }[];
  directoryResultCount?: number;
  detail?: {
    category: string;
    back: string;
    backLabel?: string;
    source: { href: string; label: string };
    preview: WorkspaceDetailPreview;
    tabs?: readonly { name: string; href: string; active: boolean }[];
    panel?: { kind: 'references'; author: string; license: string } | { kind: 'prompt'; prompt: string } |
      { kind: 'source'; download: string; files: readonly string[] };
  };
  cards?: readonly {
    id: string;
    href: string;
    title: string;
    description: string;
    category: string;
    source: string;
    sourceHref?: string;
    previewHref?: string;
    sourceAuthor?: string;
    poster?: string;
    ratio?: number;
    placeholder?: 'source' | 'sound' | 'interaction';
    slots: Partial<Record<1 | 2 | 3, { column: number; row: number }>>;
  }[];
}

export interface WorkspaceShellOptions {
  assetPrefix?: string;
  extraStyles?: readonly string[];
  rootAttributes?: Record<string, string | boolean>;
  libraryHidden?: boolean;
  entry?: string | null;
  head?: WorkspaceShellHead;
  fallback?: WorkspaceShellFallback;
  detailBootstrap?: { count: number; record: Record<string, unknown> };
  chrome?: WorkspaceChrome;
}

export interface WorkspaceChrome {
  dock?: readonly string[];
  items: readonly { id: string; icon: string; label: string; href: string; active: boolean; count?: number }[];
  home: string;
  search: string;
  breadcrumb: string;
  renderIcon: (name: string) => string;
}

export function inspectWorkspaceShell(source: string): { styles: string[]; entry: string };
export function inspectWorkspaceChrome(source: string): { theme: string; sidebar: string; topbar: string };
export function renderWorkspaceChrome(
  fragments: { sidebar: string; topbar: string }, config: WorkspaceChrome,
): { sidebar: string; topbar: string };
export function renderWorkspaceShell(source: string, options?: WorkspaceShellOptions): string;
