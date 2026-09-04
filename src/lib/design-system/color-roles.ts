import semanticTokenCss from '../../styles/tokens.css?raw';

const tokenValues = new Map(
  [...semanticTokenCss.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)].map((match) => [
    match[1],
    match[2].trim(),
  ]),
);

function resolveHexToken(token: string, visited = new Set<string>()): string {
  if (visited.has(token)) throw new Error(`circular semantic color token: ${token}`);
  const rawValue = tokenValues.get(token);
  if (!rawValue) throw new Error(`missing semantic color token: ${token}`);

  const alias = rawValue.match(/^var\((--[a-z0-9-]+)\)$/i)?.[1];
  if (alias) return resolveHexToken(alias, new Set([...visited, token]));
  if (!/^#[0-9a-f]{6}$/i.test(rawValue)) {
    throw new Error(`semantic color token is not a solid sRGB color: ${token}=${rawValue}`);
  }
  return rawValue.toUpperCase();
}

function relativeLuminance(hex: string): number {
  const channels = hex.match(/[0-9a-f]{2}/gi);
  if (!channels || channels.length !== 3) throw new Error(`invalid sRGB color: ${hex}`);
  const [red, green, blue] = channels
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) => (
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4
    ));
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

export function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

/* Each row documents the pairing the site actually renders. Settlement is a
   marker drawn on a surface, never a fill behind white text, so it is measured
   the same way Verified is rather than against a white it never sits under. */
const roleSpecs = [
  { name: 'Background', token: '--color-bg', foreground: '--color-text', background: '--color-bg', pair: 'Text / Background' },
  { name: 'Surface', token: '--color-surface', foreground: '--color-text', background: '--color-surface', pair: 'Text / Surface' },
  { name: 'Action', token: '--color-action', foreground: '--color-on-action', background: '--color-action', pair: 'Label / Action' },
  { name: 'Verified', token: '--color-verified', foreground: '--color-verified', background: '--color-surface', pair: 'Verified / Surface', qualification: ' · large text/UI only' },
  { name: 'Settlement', token: '--color-settlement', foreground: '--color-settlement', background: '--color-surface', pair: 'Settlement / Surface', qualification: ' · large text/UI only' },
] as const;

export const DESIGN_SYSTEM_COLOR_ROLES = roleSpecs.map((role) => {
  const foreground = resolveHexToken(role.foreground);
  const background = resolveHexToken(role.background);
  const qualification = 'qualification' in role ? role.qualification : '';
  return {
    name: role.name,
    token: role.token,
    value: resolveHexToken(role.token),
    contrast: `${role.pair} · ${contrastRatio(foreground, background).toFixed(2)}:1${qualification}`,
  };
});
