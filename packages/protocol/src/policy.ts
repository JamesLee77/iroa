import { z } from 'zod';

export const Hex32Schema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, 'Expected a 32-byte 0x-prefixed hexadecimal value')
  .transform((value) => value as `0x${string}`);

export const AddressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, 'Expected a 20-byte 0x-prefixed address')
  .transform((value) => value as `0x${string}`);

export const SignatureSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{130}$/, 'Expected a 65-byte 0x-prefixed signature')
  .transform((value) => value as `0x${string}`);

export const UnixSecondsSchema = z.number().int().nonnegative().safe();

export const ChainIdSchema = z.union([z.literal(8453), z.literal(84532), z.literal(31337)]);

export const DecimalUintSchema = z
  .string()
  .regex(/^(0|[1-9][0-9]*)$/, 'Expected an unsigned base-10 integer without leading zeros');

export const PolicyVersionSchema = z
  .string()
  .regex(/^[1-9][0-9]*\.[0-9]+\.[0-9]+$/, 'Expected a semantic policy version');

export type Hex32 = z.infer<typeof Hex32Schema>;
export type Address = z.infer<typeof AddressSchema>;
export type Signature = z.infer<typeof SignatureSchema>;
export type ChainId = z.infer<typeof ChainIdSchema>;
export type DecimalUint = z.infer<typeof DecimalUintSchema>;
export type PolicyVersion = z.infer<typeof PolicyVersionSchema>;
