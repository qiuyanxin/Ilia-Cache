export function registerCatalogTools<T>(server: T, options: {
  catalog: object;
  scope: 'public' | 'local';
  previewBaseUrl?: string;
  writeToken?: string;
  ResourceTemplate: object;
  resourceError(message: string, invalid: boolean): Error;
}): T;
