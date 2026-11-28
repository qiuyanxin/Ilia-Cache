interface WebsiteLink {
  url: string;
  title?: string;
  name?: string;
  note?: string;
}

interface WebsiteRecord {
  id: string;
  domain: string;
  category: string;
  url: string;
  name?: string;
  title?: string;
  description?: string;
  finds?: string;
  use?: string;
  gets?: string;
  cost?: string;
  tags?: string[];
  created?: string;
  favorite?: boolean;
  previewable?: boolean;
  cases?: WebsiteLink[];
  members?: WebsiteLink[];
  links?: WebsiteLink[];
}

interface WebsiteSearch {
  query: string;
  category: string;
  filter: string;
  order: string;
  layout: 'list' | 'deck';
  selected: string;
}

interface WebsiteActions {
  actions?: (site: WebsiteRecord) => string;
  canFrame?: (url: string) => boolean;
}

export const WEBSITE_FILTERS: readonly string[];
export const WEBSITE_SORTS: readonly (readonly [string, string])[];
export function websiteTitle(site: WebsiteRecord): string;
export function websiteCategories(sites: WebsiteRecord[]): string[];
export function readWebsiteFilters(params: URLSearchParams, sites: WebsiteRecord[]): WebsiteSearch;
export function filterWebsites<T extends WebsiteRecord>(sites: T[], options?: Partial<WebsiteSearch> & { view?: string; favoritesFirst?: boolean }): T[];
export function renderWebsiteRows(sites: WebsiteRecord[], options?: { selected?: string; tooltipId?: string; preview?: boolean; actions?: WebsiteActions['actions'] }): string;
export function renderWebsiteCards(sites: WebsiteRecord[], options?: WebsiteActions & { screenshot?: (site: WebsiteRecord) => string }): string;
export function renderWebsiteLayoutSwitch(layout: WebsiteSearch['layout']): string;
export function renderWebsiteInspector(site: WebsiteRecord | undefined, options?: WebsiteActions): string;
export function renderWebsiteDirectory(sites: WebsiteRecord[], options: WebsiteActions & { state: WebsiteSearch; rows: WebsiteRecord[]; path: string }): string;
export function canPreviewPublicWebsite(url: string, currentUrl: string): boolean;
