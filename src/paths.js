import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

export const rootDir = fileURLToPath(new URL('..', import.meta.url));
export const cacheDir = process.env.RGO_MUSIC_CACHE ?? join(rootDir, 'cache');
export const libraryDir = process.env.RGO_MUSIC_LIBRARY ?? join(rootDir, 'library');
export const assetsDir = join(rootDir, 'assets');
