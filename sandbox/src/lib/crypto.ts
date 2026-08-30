import type { Hex32 } from '@iroa/protocol';

function bytesToHex(bytes: Uint8Array): Hex32 {
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}` as Hex32;
}

export function randomHex32(): Hex32 {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
}

export async function sha256Hex(value: string): Promise<Hex32> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}
