import { Hex32Schema, type Hex32 } from '@iroa/protocol';
import { encodePacked, keccak256 } from 'viem';

export function hashOperatorId(operatorId: string, privacySalt: Hex32): Hex32 {
  const normalizedId = operatorId.trim().normalize('NFKC').toLocaleLowerCase('en-US');
  if (normalizedId.length === 0) {
    throw new Error('operatorId must not be empty');
  }

  const salt = Hex32Schema.parse(privacySalt) as Hex32;
  return keccak256(encodePacked(['string', 'bytes32'], [normalizedId, salt])) as Hex32;
}
