import type { ComponentBrowseFilters } from './component-browse.mjs';

type ComponentRouteFilters = Required<Pick<ComponentBrowseFilters, 'category' | 'query' | 'source'>> &
  Pick<ComponentBrowseFilters, 'subcategory'>;

export type ComponentDetailTab = '预览' | '参考素材' | '提示词' | '源码';

export function componentDetailTabs(options: { references: boolean; source: boolean }): ComponentDetailTab[];
export function readComponentDetailTab(parameters?: string | URLSearchParams): ComponentDetailTab;
export function componentDetailTabQuery(tab: ComponentDetailTab, parameters?: string | URLSearchParams): string;

export function readComponentFilters(
  parameters?: string | URLSearchParams,
  options?: { sources?: ReadonlySet<string> },
): ComponentRouteFilters;

export function componentFilterQuery(filters: ComponentBrowseFilters, parameters?: string | URLSearchParams): string;
