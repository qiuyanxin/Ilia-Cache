export const FONT_GROUPS: readonly string[];

export type FontRecord = {
  id: string;
  name: string;
  category?: string;
  chinese?: boolean;
  commercial?: string;
  cssFamily?: string;
  fontUrl?: string;
  localFamily?: string;
  note?: string;
  previewUrl?: string;
  source?: string;
  sourceUrl?: string;
};

export function renderFontLibrary(records: readonly FontRecord[], options?: {
  canAdd?: boolean;
  canDelete?: boolean;
  canCollect?: boolean;
  isFavorite?: (font: FontRecord) => boolean;
}): string;

export function mountFontLibrary(page: HTMLElement, options: {
  getRecords: () => readonly FontRecord[];
  onAdd?: (dialog: HTMLDialogElement) => void;
  onDelete?: (font: FontRecord) => boolean;
  isFavorite?: (font: FontRecord) => boolean;
  isCollected?: (font: FontRecord) => boolean;
  onCollect?: (font: FontRecord) => void;
  canCollect?: boolean;
  hydrate?: boolean;
}): { refresh: () => void; destroy: () => void; open: (id: string) => void };
