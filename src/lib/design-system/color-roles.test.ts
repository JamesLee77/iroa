// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { DESIGN_SYSTEM_COLOR_ROLES } from './color-roles';

describe('design-system color-role evidence', () => {
  it('derives the published sRGB contrast from the production semantic tokens', () => {
    expect(DESIGN_SYSTEM_COLOR_ROLES).toEqual([
      {
        name: 'Background',
        token: '--color-bg',
        value: '#F7F9FB',
        contrast: 'Text / Background · 13.03:1',
      },
      {
        name: 'Surface',
        token: '--color-surface',
        value: '#FFFFFF',
        contrast: 'Text / Surface · 13.75:1',
      },
      {
        name: 'Action',
        token: '--color-action',
        value: '#0E7490',
        contrast: 'Label / Action · 5.36:1',
      },
      {
        name: 'Verified',
        token: '--color-verified',
        value: '#0F766E',
        contrast: 'Verified / Surface · 5.47:1 · large text/UI only',
      },
      {
        name: 'Settlement',
        token: '--color-settlement',
        value: '#1D4ED8',
        contrast: 'Settlement / Surface · 6.70:1 · large text/UI only',
      },
    ]);
  });

  it('keeps every published role at or above the AA body-text threshold', () => {
    for (const role of DESIGN_SYSTEM_COLOR_ROLES) {
      const ratio = Number.parseFloat(role.contrast.split('·')[1]);
      expect(ratio, role.name).toBeGreaterThanOrEqual(4.5);
    }
  });
});
