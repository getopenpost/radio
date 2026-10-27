// Regenerate after changing the shelf, font widths, or default panel geometry.
import { writeFile } from 'node:fs/promises';
import { paginateBook } from '../src/stream/scene/book-layout.js';
const layout = paginateBook(88, 15);
await writeFile(new URL('../src/stream/scene/content/book-pages.json', import.meta.url), JSON.stringify(layout) + '\n');
console.log(`prepared ${layout.pages.length} book pages`);
