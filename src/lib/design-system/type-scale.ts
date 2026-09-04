import semanticTokenCss from '../../styles/tokens.css?raw';

const tokenValues = new Map(
  [...semanticTokenCss.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)].map((match) => [
    match[1],
    match[2].trim(),
  ]),
);

function resolveToken(token: string): string {
  const value = tokenValues.get(token);
  if (!value) throw new Error(`missing type token: ${token}`);
  return value;
}

/** Smallest rendered size a step can produce, in px, at a 16px root. */
export function floorPx(value: string): number {
  const clamp = value.match(/^clamp\(\s*([0-9.]+)rem\s*,/);
  if (clamp) return Number.parseFloat(clamp[1]) * 16;
  const rem = value.match(/^([0-9.]+)rem$/);
  if (rem) return Number.parseFloat(rem[1]) * 16;
  throw new Error(`type token is neither a rem nor a clamp: ${value}`);
}

const stepSpecs = [
  { token: '--text-2xs', role: 'Label, caption' },
  { token: '--text-xs', role: 'Secondary label, field value' },
  { token: '--text-sm', role: 'Supporting copy' },
  { token: '--text-base', role: 'Body' },
  { token: '--text-md', role: 'Lead, emphasised body' },
  { token: '--text-lg', role: 'Subheading' },
  { token: '--text-xl', role: 'Section heading, small' },
  { token: '--text-2xl', role: 'Section heading' },
  { token: '--text-3xl', role: 'Page heading' },
  { token: '--text-4xl', role: 'Page heading, large' },
] as const;

const displaySpecs = [
  { token: '--display-sm', role: 'Panel opener' },
  { token: '--display-md', role: 'Section opener' },
  { token: '--display-lg', role: 'Chapter opener' },
  { token: '--display-xl', role: 'Masthead' },
] as const;

const describe = ({ token, role }: { token: string; role: string }) => {
  const value = resolveToken(token);
  return { token, role, value, floorPx: floorPx(value) };
};

/** UI text steps, smallest first. */
export const DESIGN_SYSTEM_TYPE_SCALE = stepSpecs.map(describe);

/** Editorial display steps, kept separate from UI text. */
export const DESIGN_SYSTEM_DISPLAY_SCALE = displaySpecs.map(describe);

/**
 * The smallest size the system is allowed to render. Readers here are older
 * adults and their carers, so the scale does not go below 12px.
 */
export const TYPE_SCALE_FLOOR_PX = 12;
