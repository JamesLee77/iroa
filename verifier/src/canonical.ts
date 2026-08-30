import { createHash } from 'node:crypto';
import type { Hex32 } from '@iroa/protocol';

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error('CANONICAL_VALUE_UNSUPPORTED');
  return encoded;
}

export function sha256Hex(value: string | Uint8Array): Hex32 {
  return `0x${createHash('sha256').update(value).digest('hex')}` as Hex32;
}
