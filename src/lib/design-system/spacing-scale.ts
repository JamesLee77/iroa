import semanticTokenCss from '../../styles/tokens.css?raw';

const tokenValues = new Map(
  [...semanticTokenCss.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)].map((match) => [
    match[1],
    match[2].trim(),
  ]),
);

function resolveToken(token: string): string {
  const value = tokenValues.get(token);
  if (!value) throw new Error(`missing spacing token: ${token}`);
  return value;
}

/** Smallest rendered length a step can produce, in px, at a 16px root. */
export function stepPx(value: string): number {
  const clamp = value.match(/^clamp\(\s*([0-9.]+)rem\s*,/);
  if (clamp) return Number.parseFloat(clamp[1]) * 16;
  const rem = value.match(/^([0-9.]+)rem$/);
  if (rem) return Number.parseFloat(rem[1]) * 16;
  throw new Error(`spacing token is neither a rem nor a clamp: ${value}`);
}

const describe = (token: string) => {
  const value = resolveToken(token);
  return { token, value, px: stepPx(value) };
};

/** The 4px rhythm used inside components, smallest first. */
export const DESIGN_SYSTEM_SPACING_SCALE = [
  '--space-1', '--space-2', '--space-3', '--space-4', '--space-5', '--space-6',
  '--space-7', '--space-8', '--space-9', '--space-10', '--space-11', '--space-12',
].map(describe);

/**
 * Section rhythm. The component steps stop at 3rem, so the gaps between whole
 * sections and the sticky-header scroll offset are their own tokens.
 */
export const DESIGN_SYSTEM_SECTION_SPACING = [
  { ...describe('--space-section'), role: 'Between sections' },
  { ...describe('--space-section-compact'), role: 'Between sections, narrow' },
  { ...describe('--scroll-offset'), role: 'Anchor clears sticky header' },
];
