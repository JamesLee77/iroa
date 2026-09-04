// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { DESIGN_SYSTEM_SECTION_SPACING, DESIGN_SYSTEM_SPACING_SCALE } from './spacing-scale';

describe('design-system spacing scale', () => {
  it('keeps the component rhythm on a 4px grid', () => {
    for (const step of DESIGN_SYSTEM_SPACING_SCALE) {
      expect(step.px % 4, step.token).toBe(0);
    }
  });

  it('rises monotonically with no repeated step', () => {
    const px = DESIGN_SYSTEM_SPACING_SCALE.map((step) => step.px);
    expect(px).toEqual([...px].sort((a, b) => a - b));
    expect(new Set(px).size).toBe(px.length);
  });

  it('starts section rhythm above where the component rhythm stops', () => {
    const componentTop = Math.max(...DESIGN_SYSTEM_SPACING_SCALE.map((step) => step.px));
    for (const step of DESIGN_SYSTEM_SECTION_SPACING) {
      expect(step.px, step.token).toBeGreaterThan(componentTop);
    }
  });
});
