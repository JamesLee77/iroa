// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { DESIGN_SYSTEM_COLOR_ROLES } from './color-roles';

describe('design-system color-role evidence', () => {
  it('derives the published sRGB contrast from the production semantic tokens', () => {
    expect(DESIGN_SYSTEM_COLOR_ROLES).toEqual([
      {
        name: 'Background',
        token: '--color-bg',
        value: '#F9FAFB',
        contrast: 'Navy / Background · 14.57:1',
      },
      {
        name: 'Surface',
        token: '--color-surface',
        value: '#FFFFFF',
        contrast: 'Navy / White · 15.23:1',
      },
      {
        name: 'Action',
        token: '--color-action',
        value: '#F06D5E',
        contrast: 'Navy / Coral · 5.12:1',
      },
      {
        name: 'Verified',
        token: '--color-verified',
        value: '#3D8B83',
        contrast: 'Teal / White · 4.02:1 · large text/UI only',
      },
      {
        name: 'Settlement',
        token: '--color-settlement',
        value: '#246FD4',
        contrast: 'White / Settlement · 4.88:1',
      },
    ]);
  });
});
