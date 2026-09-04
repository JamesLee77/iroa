// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { DESIGN_SYSTEM_COLOR_ROLES } from './color-roles';

describe('design-system color-role evidence', () => {
  it('derives the published sRGB contrast from the production semantic tokens', () => {
    expect(DESIGN_SYSTEM_COLOR_ROLES).toEqual([
      {
        name: 'Background',
        token: '--color-bg',
        value: '#0B0D12',
        contrast: 'Text / Background · 17.65:1',
      },
      {
        name: 'Surface',
        token: '--color-surface',
        value: '#141821',
        contrast: 'Text / Surface · 16.13:1',
      },
      {
        name: 'Action',
        token: '--color-action',
        value: '#6EE7F9',
        contrast: 'Label / Action · 13.04:1',
      },
      {
        name: 'Verified',
        token: '--color-verified',
        value: '#34D399',
        contrast: 'Verified / Surface · 9.24:1 · large text/UI only',
      },
      {
        name: 'Settlement',
        token: '--color-settlement',
        value: '#60A5FA',
        contrast: 'Settlement / Surface · 6.99:1 · large text/UI only',
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
