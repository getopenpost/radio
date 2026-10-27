// Offline page layout. The live panel uses the prebuilt default layout.
import { wrap } from './text.js';
import { BOOKS } from './content/book.js';

export function paginateBook(width, rows) {
  const pages = [];
  let lines = [];
  let book = BOOKS[0];
  const flush = () => {
    while (lines.length && !lines.at(-1).text) lines.pop();
    if (lines.length) pages.push({ title: book.title, author: book.author, lines });
    lines = [];
  };
  const put = (line) => {
    lines.push(line);
    if (lines.length >= rows) flush();
  };
  for (const b of BOOKS) {
    book = b;
    for (const chapter of b.chapters) {
      put({ text: '', head: false });
      put({ text: chapter.title, head: true });
      put({ text: '', head: false });
      for (const para of chapter.paragraphs) {
        for (const row of wrap(para, width, true)) put({ text: row, head: false });
        put({ text: '', head: false });
      }
    }
    flush();
  }
  const full = [];
  for (let i = 0; i < pages.length; i++) {
    const here = pages[i].lines.filter((line) => line.text).length / rows;
    const next = pages[(i + 1) % pages.length].lines.filter((line) => line.text).length / rows;
    if (here > 0.75 && next > 0.75) full.push(i);
  }
  return { width, rows, pages, full };
}
