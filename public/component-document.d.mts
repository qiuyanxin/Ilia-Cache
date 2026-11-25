export interface ComponentPage {
  path: string;
  title: string;
  description: string;
}

export const componentGalleryPage: Readonly<ComponentPage>;
export function componentDetailPath(id: string): string;
export function componentDetailPage(record: {
  id: string;
  originalName?: string;
  title?: string;
  name?: string;
  description?: string;
}): ComponentPage;
