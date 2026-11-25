import type { ComponentSearchFilters } from './component-search.mjs';

export type ComponentDetailTab = '预览' | '参考素材' | '提示词' | '源码';

export function componentDetailTabs(options: { references: boolean; source: boolean }): ComponentDetailTab[];
export function readComponentDetailTab(parameters?: string | URLSearchParams): ComponentDetailTab;
export function componentDetailTabQuery(tab: ComponentDetailTab, parameters?: string | URLSearchParams): string;

export function readComponentFilters(
  parameters?: string | URLSearchParams,
  options?: { sources?: ReadonlySet<string> },
): Required<ComponentSearchFilters>;

export function componentFilterQuery(filters: ComponentSearchFilters, parameters?: string | URLSearchParams): string;
