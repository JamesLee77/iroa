import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/foundations.css', 'utf8');

describe('IROA responsive foundations', () => {
  it('does not impose a minimum width on the document', () => {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.append(style);

    try {
      expect([
        getComputedStyle(document.documentElement).minWidth,
        getComputedStyle(document.body).minWidth,
      ]).toEqual(['auto', 'auto']);
    } finally {
      style.remove();
    }
  });
});
