import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/tokens.css', 'utf8');

describe('IROA semantic tokens', () => {
  it.each([
    '--color-bg',
    '--color-surface',
    '--color-text',
    '--color-action',
    '--color-on-action',
    '--color-verified',
    '--color-focus',
    '--control-min',
  ])('defines %s', (token) => expect(css).toContain(`${token}:`));

  it('uses Navy text on the Coral action fill', () => {
    expect(css).toMatch(/--color-action:\s*var\(--brand-coral\)/);
    expect(css).toMatch(/--color-on-action:\s*var\(--brand-navy\)/);
  });
});
