import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export const libraryDirectory = process.env.ILIA_DATA_DIR
  ? pathToFileURL(resolve(process.env.ILIA_DATA_DIR) + sep)
  : new URL('./data/', import.meta.url);
