import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DESIGN_SYSTEM_COLOR_ROLES } from './color-roles';

const css = readFileSync('src/styles/tokens.css', 'utf8');

describe('IROA semantic tokens', () => {
  it.each([
    '--color-bg',
    '--color-surface',
    '--color-text',
    '--color-action',
    '--color-on-action',
    '--color-verified',
    '--color-settlement',
    '--color-focus',
    '--control-min',
  ])('defines %s', (token) => expect(css).toContain(`${token}:`));

  /* The old form pinned the action fill to Coral and its label to Navy, which
     described one palette rather than the property that matters. What must hold
     through a palette change is that the label stays legible on the fill. */
  it('keeps the action label legible on the action fill', () => {
    const [{ contrast }] = DESIGN_SYSTEM_COLOR_ROLES.filter((role) => role.name === 'Action');
    expect(Number.parseFloat(contrast.split('·')[1])).toBeGreaterThanOrEqual(4.5);
  });
});
