// @vitest-environment node

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DESIGN_SYSTEM_DISPLAY_SCALE,
  DESIGN_SYSTEM_TYPE_SCALE,
  TYPE_SCALE_FLOOR_PX,
  floorPx,
} from './type-scale';

/** Stylesheets that paint the published pages. tokens.css declares the scale
 *  itself, and global.css is imported by no layout. */
const liveStylesheets = ['src/styles/foundations.css', 'src/styles/components.css', 'src/styles/pages.css'];

/** Print rules set physical point sizes and are outside the screen scale. */
const withoutPrintRules = (css: string) => css.replace(/@media print\s*\{[\s\S]*?\n\}/g, '');

const screenDeclarations = liveStylesheets.flatMap((path) =>
  [...withoutPrintRules(readFileSync(path, 'utf8')).matchAll(/font-size:\s*([^;}]+)/g)]
    .map((match) => `${path}: ${match[1].trim()}`));

/**
 * Every size a live stylesheet may set without naming a scale token. Each entry
 * is a deliberate exception; anything else appearing here means a one-off size
 * crept back in.
 */
const allowedOffScale = [
  // The root respects whatever body size the reader has set in their browser.
  'src/styles/foundations.css: 100%',
  // Controls stay at 16px or larger so iOS does not zoom the page on focus.
  'src/styles/foundations.css: max(1rem, 16px)',
  'src/styles/components.css: max(1rem, 16px)',
  // Display steps are capped against the viewport on small screens, where a
  // vw-based clamp would otherwise overshoot the line box.
  'src/styles/pages.css: clamp(2.55rem, 13vw, 3.5rem)',
  'src/styles/pages.css: clamp(2rem, 10vw, 2.65rem)',
  'src/styles/pages.css: clamp(2rem, 10vw, 2.75rem)',
  'src/styles/pages.css: clamp(2.75rem, 12.4vw, 3.1rem)',
];

describe('design-system type scale', () => {
  it('never renders below the 12px floor the audience needs', () => {
    for (const step of [...DESIGN_SYSTEM_TYPE_SCALE, ...DESIGN_SYSTEM_DISPLAY_SCALE]) {
      expect(step.floorPx, step.token).toBeGreaterThanOrEqual(TYPE_SCALE_FLOOR_PX);
    }
  });

  it('rises monotonically so a larger step is never smaller than the one below', () => {
    const floors = DESIGN_SYSTEM_TYPE_SCALE.map((step) => step.floorPx);
    expect(floors).toEqual([...floors].sort((a, b) => a - b));
    expect(new Set(floors).size).toBe(floors.length);
  });

  it('sizes live stylesheets from the scale apart from the documented exceptions', () => {
    const offScale = screenDeclarations.filter((entry) => !entry.includes('var(--'));
    expect(offScale.sort()).toEqual([...allowedOffScale].sort());
  });

  it('keeps the viewport-capped overrides above the floor too', () => {
    for (const entry of allowedOffScale.filter((value) => value.includes('clamp('))) {
      expect(floorPx(entry.split(': ')[1]), entry).toBeGreaterThanOrEqual(TYPE_SCALE_FLOOR_PX);
    }
  });
});
