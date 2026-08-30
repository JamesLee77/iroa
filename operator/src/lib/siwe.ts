import type { Address } from 'viem';

export function buildSiweMessage(input: {
  address: Address;
  chainId: number;
  nonce: string;
  expiresAt: number;
  origin: string;
}): string {
  const origin = new URL(input.origin);
  const issuedAt = new Date().toISOString();
  const expirationTime = new Date(input.expiresAt * 1_000).toISOString();
  return [
    `${origin.host} wants you to sign in with your Ethereum account:`,
    input.address,
    '',
    'Sign in to the private IROA operator portal',
    '',
    `URI: ${origin.toString()}`,
    'Version: 1',
    `Chain ID: ${input.chainId}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${issuedAt}`,
    `Expiration Time: ${expirationTime}`,
  ].join('\n');
}
