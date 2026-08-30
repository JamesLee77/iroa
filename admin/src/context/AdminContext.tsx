import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useReadContracts } from 'wagmi';
import {
  useConnect,
  useConnection,
  useConnectors,
  useDisconnect,
  useSignMessage,
  useSwitchChain,
} from 'wagmi';
import {
  authenticateSiwe,
  clearSession,
  loadIdentity,
  readSession,
  requestSiweChallenge,
  type AdminIdentity,
  type AdminSession,
} from '../lib/api';
import { nodeRegistryAbi, rootRegistryAbi, type RequiredRole } from '../lib/contracts';
import { canPerform, type AdminAction } from '../lib/personas';
import { adminProfile, selectedChain } from '../lib/wagmi';

const DENIED_IDENTITY: AdminIdentity = { accessVerified: false, persona: 'read_only' };

interface AdminContextValue {
  identity: AdminIdentity;
  identityLoading: boolean;
  address: `0x${string}` | undefined;
  session: AdminSession | null;
  isConnected: boolean;
  wrongChain: boolean;
  busy: boolean;
  error: string | null;
  roleReady: boolean;
  roles: Readonly<Record<RequiredRole, boolean>>;
  connectors: ReturnType<typeof useConnectors>;
  canWrite(action: AdminAction, role: RequiredRole): boolean;
  connectWallet(connector: ReturnType<typeof useConnectors>[number]): void;
  disconnectWallet(): void;
  switchChain(): void;
  signIn(): Promise<void>;
}

const AdminContext = createContext<AdminContextValue | null>(null);

function siweMessage(input: { address: string; chainId: number; nonce: string; expiresAt: number }): string {
  const origin = new URL('/', window.location.origin).toString();
  return [
    `${window.location.host} wants you to sign in with your Ethereum account:`, input.address, '',
    'Sign in to the private IROA admin console', '', `URI: ${origin}`, 'Version: 1',
    `Chain ID: ${input.chainId}`, `Nonce: ${input.nonce}`, `Issued At: ${new Date().toISOString()}`,
    `Expiration Time: ${new Date(input.expiresAt * 1_000).toISOString()}`,
  ].join('\n');
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const connection = useConnection();
  const connectors = useConnectors();
  const { connect, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const { signMessageAsync, isPending: signing } = useSignMessage();
  const [identity, setIdentity] = useState<AdminIdentity>(DENIED_IDENTITY);
  const [identityLoading, setIdentityLoading] = useState(true);
  const [session, setSession] = useState<AdminSession | null>(() => readSession());
  const [error, setError] = useState<string | null>(null);
  const address = connection.address;
  const isConnected = connection.isConnected;
  const wrongChain = isConnected && connection.chainId !== selectedChain.id;
  const roleSubject = address;
  const nodeRegistry = adminProfile.contracts.nodeRegistry;
  const rootRegistry = adminProfile.contracts.rootRegistry;

  const roleReads = useReadContracts({
    allowFailure: true,
    query: { enabled: Boolean(roleSubject && nodeRegistry && rootRegistry && !wrongChain) },
    contracts: roleSubject && nodeRegistry && rootRegistry ? [
      { address: nodeRegistry, abi: nodeRegistryAbi, functionName: 'COMPLIANCE_ROLE' },
      { address: nodeRegistry, abi: nodeRegistryAbi, functionName: 'SUSPENDER_ROLE' },
      { address: rootRegistry, abi: rootRegistryAbi, functionName: 'CHALLENGER_ROLE' },
      { address: rootRegistry, abi: rootRegistryAbi, functionName: 'ROOT_PROPOSER_ROLE' },
    ] : [],
  });
  const roleIds = roleReads.data?.map((item) => item.status === 'success' ? item.result : undefined) ?? [];
  const hasRoleReads = useReadContracts({
    allowFailure: true,
    query: { enabled: Boolean(roleSubject && nodeRegistry && rootRegistry && roleIds.length === 4 && roleIds.every(Boolean) && !wrongChain) },
    contracts: roleSubject && nodeRegistry && rootRegistry && roleIds.length === 4 && roleIds.every(Boolean) ? [
      { address: nodeRegistry, abi: nodeRegistryAbi, functionName: 'hasRole', args: [roleIds[0] as `0x${string}`, roleSubject] },
      { address: nodeRegistry, abi: nodeRegistryAbi, functionName: 'hasRole', args: [roleIds[1] as `0x${string}`, roleSubject] },
      { address: rootRegistry, abi: rootRegistryAbi, functionName: 'hasRole', args: [roleIds[2] as `0x${string}`, roleSubject] },
      { address: rootRegistry, abi: rootRegistryAbi, functionName: 'hasRole', args: [roleIds[3] as `0x${string}`, roleSubject] },
    ] : [],
  });
  const results = hasRoleReads.data ?? [];
  const roleReady = results.length === 4 && results.every((item) => item.status === 'success');
  const roles: Readonly<Record<RequiredRole, boolean>> = {
    compliance: roleReady && results[0]?.result === true,
    suspender: roleReady && results[1]?.result === true,
    challenger: roleReady && results[2]?.result === true,
    rootProposer: roleReady && results[3]?.result === true,
  };

  useEffect(() => {
    let cancelled = false;
    loadIdentity().then((value) => { if (!cancelled) setIdentity(value); })
      .catch(() => { if (!cancelled) setIdentity(DENIED_IDENTITY); })
      .finally(() => { if (!cancelled) setIdentityLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (session && (!address || session.wallet.toLowerCase() !== address.toLowerCase() || session.expiresAt <= Math.floor(Date.now() / 1_000) + 5)) {
      clearSession();
      setSession(null);
    }
  }, [address, session]);

  async function signIn(): Promise<void> {
    if (!address || wrongChain || !identity.accessVerified) return;
    setError(null);
    try {
      const challenge = await requestSiweChallenge({ domain: window.location.host, uri: new URL('/', window.location.origin).toString(), chainId: selectedChain.id });
      const message = siweMessage({ address, chainId: selectedChain.id, nonce: challenge.nonce, expiresAt: challenge.expiresAt });
      const signature = await signMessageAsync({ message });
      setSession(await authenticateSiwe(message, signature, address));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'ADMIN_SIGN_IN_FAILED'); }
  }

  const value = useMemo<AdminContextValue>(() => ({
    identity,
    identityLoading,
    address,
    session,
    isConnected,
    wrongChain,
    busy: connecting || switching || signing,
    error,
    roleReady,
    roles,
    connectors,
    canWrite(action, role) {
      return Boolean(identity.accessVerified && canPerform(identity.persona, action) && session && address
        && session.wallet.toLowerCase() === address.toLowerCase() && !wrongChain && adminProfile.configured && roleReady && roles[role]);
    },
    connectWallet(connector) { setError(null); connect({ connector }); },
    disconnectWallet() { clearSession(); setSession(null); disconnect(); },
    switchChain() { setError(null); switchChain({ chainId: selectedChain.id }); },
    signIn,
  }), [address, connect, connecting, connectors, disconnect, error, identity, identityLoading, isConnected, roleReady, roles, session, signing, switchChain, switching, wrongChain]);

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminContextValue {
  const value = useContext(AdminContext);
  if (!value) throw new Error('ADMIN_PROVIDER_REQUIRED');
  return value;
}
