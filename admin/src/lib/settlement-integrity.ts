import type { AdminSettlement } from './api';

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error('SETTLEMENT_ARTIFACT_UNSUPPORTED_VALUE');
  return encoded;
}

export async function verifySettlementArtifact(settlement: AdminSettlement): Promise<void> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(settlement.canonicalArtifact));
  const actual = `0x${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  if (actual.toLowerCase() !== settlement.artifactSha256.toLowerCase()) throw new Error('SETTLEMENT_ARTIFACT_HASH_MISMATCH');
  let artifact: unknown;
  try { artifact = JSON.parse(settlement.canonicalArtifact); }
  catch { throw new Error('SETTLEMENT_ARTIFACT_INVALID_JSON'); }
  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) throw new Error('SETTLEMENT_ARTIFACT_INVALID');
  const { canonicalArtifact: _canonicalArtifact, artifactSha256: _artifactSha256, ...envelope } = settlement;
  if (canonicalJson(artifact) !== canonicalJson(envelope)) throw new Error('SETTLEMENT_ARTIFACT_CONTENT_MISMATCH');
}
