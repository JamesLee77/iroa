import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Address, ChainId, Hex32 } from '@iroa/protocol';
import { AddressSchema, ChainIdSchema, Hex32Schema, SignatureSchema } from '@iroa/protocol';
import { getAddress, verifyMessage } from 'viem';
import { hashIdentifier } from './audit.js';

export type SessionKind = 'sandbox-user' | 'operator';

export interface SessionRecord {
  sessionId: string;
  kind: SessionKind;
  subject: string;
  csrfToken: string;
  expiresAt: number;
}

interface ChallengeRecord {
  nonce: string;
  kind: 'siwe' | 'node';
  subject: string;
  domain: string | null;
  uri: string | null;
  chainId: ChainId | null;
  expiresAt: number;
}

export interface AuthenticatedActor {
  type: 'user' | 'operator' | 'node';
  id: string;
  idHash: Hex32;
  sessionId: string | null;
}

interface ParsedSiwe {
  domain: string;
  address: Address;
  uri: string;
  chainId: ChainId;
  nonce: string;
  issuedAt: number;
  expirationTime: number;
}

const SIWE_MESSAGE = /^(?<domain>[^\r\n]+) wants you to sign in with your Ethereum account:\n(?<address>0x[0-9a-fA-F]{40})\n\n[^\r\n]{0,256}\n\nURI: (?<uri>\S+)\nVersion: 1\nChain ID: (?<chainId>\d+)\nNonce: (?<nonce>[A-Za-z0-9]{16,64})\nIssued At: (?<issuedAt>\S+)\nExpiration Time: (?<expirationTime>\S+)$/;
const COOKIE_NAME = 'iroa_session';

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

function parseSiwe(message: string): ParsedSiwe {
  if (message.length > 4_096 || /\r/.test(message)) throw new Error('INVALID_SIWE_MESSAGE');
  const match = SIWE_MESSAGE.exec(message);
  if (!match?.groups) throw new Error('INVALID_SIWE_MESSAGE');
  const issuedAt = Date.parse(match.groups.issuedAt ?? '') / 1_000;
  const expirationTime = Date.parse(match.groups.expirationTime ?? '') / 1_000;
  if (!Number.isSafeInteger(issuedAt) || !Number.isSafeInteger(expirationTime)) {
    throw new Error('INVALID_SIWE_TIME');
  }
  return {
    domain: match.groups.domain ?? '',
    address: AddressSchema.parse(match.groups.address),
    uri: match.groups.uri ?? '',
    chainId: ChainIdSchema.parse(Number(match.groups.chainId)),
    nonce: match.groups.nonce ?? '',
    issuedAt,
    expirationTime,
  };
}

export class AuthService {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly challenges = new Map<string, ChallengeRecord>();

  constructor(
    private readonly sessionSecret: Uint8Array,
    private readonly now: () => number = () => Math.floor(Date.now() / 1_000),
    private readonly sessionTtlSeconds = 60 * 60,
    private readonly challengeTtlSeconds = 5 * 60,
  ) {
    if (sessionSecret.byteLength < 32) throw new Error('SESSION_SECRET_TOO_SHORT');
  }

  issueSandboxSession(): { session: SessionRecord; cookie: string } {
    return this.issueSession('sandbox-user', `sandbox:${base64url(randomBytes(18))}`);
  }

  issueSiweChallenge(input: { domain: string; uri: string; chainId: ChainId }): { nonce: string; expiresAt: number } {
    const domain = input.domain.trim();
    const uri = new URL(input.uri).toString();
    if (!/^[A-Za-z0-9.-]+(?::\d{1,5})?$/.test(domain)) throw new Error('INVALID_SIWE_DOMAIN');
    if (new URL(uri).host !== domain) throw new Error('SIWE_DOMAIN_URI_MISMATCH');
    const nonce = base64url(randomBytes(18));
    const expiresAt = this.now() + this.challengeTtlSeconds;
    this.challenges.set(nonce, {
      nonce,
      kind: 'siwe',
      subject: '',
      domain,
      uri,
      chainId: ChainIdSchema.parse(input.chainId),
      expiresAt,
    });
    return { nonce, expiresAt };
  }

  async authenticateSiwe(
    message: string,
    signatureInput: string,
    priorSessionId: string | null,
  ): Promise<{ actor: AuthenticatedActor; session: SessionRecord; cookie: string }> {
    const signature = SignatureSchema.parse(signatureInput);
    const parsed = parseSiwe(message);
    const challenge = this.consumeChallenge(parsed.nonce, 'siwe');
    const now = this.now();
    if (
      challenge.domain !== parsed.domain ||
      challenge.uri !== parsed.uri ||
      challenge.chainId !== parsed.chainId ||
      parsed.issuedAt > now + 30 ||
      parsed.expirationTime !== challenge.expiresAt ||
      parsed.expirationTime <= now
    ) {
      throw new Error('SIWE_CHALLENGE_MISMATCH');
    }
    const valid = await verifyMessage({
      address: getAddress(parsed.address),
      message,
      signature,
    });
    if (!valid) throw new Error('INVALID_SIWE_SIGNATURE');
    if (priorSessionId) this.sessions.delete(priorSessionId);
    const issued = this.issueSession('operator', getAddress(parsed.address));
    return { actor: this.actorFromSession(issued.session), ...issued };
  }

  issueNodeChallenge(nodeIdInput: string, deviceAddressInput: string): { nonce: string; expiresAt: number; message: string } {
    const nodeId = Hex32Schema.parse(nodeIdInput);
    const deviceAddress = AddressSchema.parse(deviceAddressInput);
    const nonce = base64url(randomBytes(18));
    const expiresAt = this.now() + this.challengeTtlSeconds;
    this.challenges.set(nonce, {
      nonce,
      kind: 'node',
      subject: `${nodeId}:${deviceAddress.toLowerCase()}`,
      domain: null,
      uri: null,
      chainId: null,
      expiresAt,
    });
    return { nonce, expiresAt, message: this.nodeChallengeMessage(nodeId, nonce, expiresAt) };
  }

  async authenticateNode(input: {
    nodeId: string;
    deviceAddress: string;
    nonce: string;
    signature: string;
  }): Promise<AuthenticatedActor> {
    const nodeId = Hex32Schema.parse(input.nodeId);
    const deviceAddress = AddressSchema.parse(input.deviceAddress);
    const signature = SignatureSchema.parse(input.signature);
    const challenge = this.consumeChallenge(input.nonce, 'node');
    if (challenge.subject !== `${nodeId}:${deviceAddress.toLowerCase()}`) {
      throw new Error('NODE_CHALLENGE_MISMATCH');
    }
    const valid = await verifyMessage({
      address: getAddress(deviceAddress),
      message: this.nodeChallengeMessage(nodeId, challenge.nonce, challenge.expiresAt),
      signature,
    });
    if (!valid) throw new Error('INVALID_NODE_SIGNATURE');
    return { type: 'node', id: nodeId, idHash: hashIdentifier(nodeId), sessionId: null };
  }

  authenticateCookie(cookieHeader: string | undefined, csrfToken?: string): AuthenticatedActor {
    const token = this.readCookie(cookieHeader);
    const [sessionId, expiresText, mac] = token.split('.');
    if (!sessionId || !expiresText || !mac || !/^\d+$/.test(expiresText)) throw new Error('INVALID_SESSION');
    const expected = this.mac(`${sessionId}.${expiresText}`);
    const suppliedBytes = Buffer.from(mac, 'base64url');
    const expectedBytes = Buffer.from(expected, 'base64url');
    if (suppliedBytes.length !== expectedBytes.length || !timingSafeEqual(suppliedBytes, expectedBytes)) {
      throw new Error('INVALID_SESSION');
    }
    const session = this.sessions.get(sessionId);
    const expiresAt = Number(expiresText);
    if (!session || session.expiresAt !== expiresAt || expiresAt <= this.now()) {
      this.sessions.delete(sessionId);
      throw new Error('SESSION_EXPIRED');
    }
    if (csrfToken !== undefined && csrfToken !== session.csrfToken) throw new Error('INVALID_CSRF_TOKEN');
    return this.actorFromSession(session);
  }

  sessionIdFromCookie(cookieHeader: string | undefined): string | null {
    try {
      return this.readCookie(cookieHeader).split('.')[0] ?? null;
    } catch {
      return null;
    }
  }

  private issueSession(kind: SessionKind, subject: string): { session: SessionRecord; cookie: string } {
    const sessionId = base64url(randomBytes(32));
    const expiresAt = this.now() + this.sessionTtlSeconds;
    const session: SessionRecord = {
      sessionId,
      kind,
      subject,
      csrfToken: base64url(randomBytes(24)),
      expiresAt,
    };
    this.sessions.set(sessionId, session);
    const payload = `${sessionId}.${expiresAt}`;
    const cookie = `${COOKIE_NAME}=${payload}.${this.mac(payload)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${this.sessionTtlSeconds}`;
    return { session: structuredClone(session), cookie };
  }

  private actorFromSession(session: SessionRecord): AuthenticatedActor {
    return {
      type: session.kind === 'operator' ? 'operator' : 'user',
      id: session.subject,
      idHash: hashIdentifier(session.subject),
      sessionId: session.sessionId,
    };
  }

  private consumeChallenge(nonce: string, kind: ChallengeRecord['kind']): ChallengeRecord {
    const challenge = this.challenges.get(nonce);
    this.challenges.delete(nonce);
    if (!challenge || challenge.kind !== kind || challenge.expiresAt <= this.now()) {
      throw new Error('CHALLENGE_EXPIRED_OR_USED');
    }
    return challenge;
  }

  private nodeChallengeMessage(nodeId: Hex32, nonce: string, expiresAt: number): string {
    return `IROA NODE AUTH\nNode ID: ${nodeId}\nNonce: ${nonce}\nExpires At: ${expiresAt}`;
  }

  private readCookie(cookieHeader: string | undefined): string {
    const entry = cookieHeader
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${COOKIE_NAME}=`));
    if (!entry) throw new Error('SESSION_REQUIRED');
    return entry.slice(COOKIE_NAME.length + 1);
  }

  private mac(payload: string): string {
    return createHmac('sha256', this.sessionSecret).update(payload).digest('base64url');
  }
}
