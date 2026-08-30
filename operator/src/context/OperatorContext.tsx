import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Address } from 'viem';
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
  clearStoredSession,
  getStoredSession,
  requestSiweChallenge,
  sessionIsActive,
  type OperatorSession,
} from '../lib/api';
import { buildSiweMessage } from '../lib/siwe';
import { operatorProfile, selectedChain } from '../lib/wagmi';

interface OperatorContextValue {
  address: Address | undefined;
  session: OperatorSession | null;
  isConnected: boolean;
  wrongChain: boolean;
  writeEnabled: boolean;
  busy: boolean;
  error: string | null;
  connectors: ReturnType<typeof useConnectors>;
  connectWallet(connector: ReturnType<typeof useConnectors>[number]): void;
  disconnectWallet(): void;
  switchToSelectedChain(): void;
  signIn(): Promise<void>;
}

const OperatorContext = createContext<OperatorContextValue | null>(null);

export function OperatorProvider({ children }: { children: ReactNode }) {
  const connection = useConnection();
  const connectors = useConnectors();
  const { connect, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const { signMessageAsync, isPending: signing } = useSignMessage();
  const [session, setSession] = useState<OperatorSession | null>(() => getStoredSession());
  const [sessionClock, setSessionClock] = useState(() => Math.floor(Date.now() / 1_000));
  const [error, setError] = useState<string | null>(null);
  const address = connection.address;
  const isConnected = connection.isConnected;
  const wrongChain = isConnected && connection.chainId !== selectedChain.id;
  const sessionActive = sessionIsActive(session, sessionClock);

  useEffect(() => {
    if (!session) return;
    const delay = Math.max(0, (session.expiresAt - Math.floor(Date.now() / 1_000) - 5) * 1_000);
    const timer = window.setTimeout(() => setSessionClock(Math.floor(Date.now() / 1_000)), delay);
    return () => window.clearTimeout(timer);
  }, [session]);

  useEffect(() => {
    if (session && (!sessionActive || !address || session.wallet.toLowerCase() !== address.toLowerCase())) {
      clearStoredSession();
      setSession(null);
    }
  }, [address, session, sessionActive]);

  async function signIn(): Promise<void> {
    if (!address || wrongChain) return;
    setError(null);
    try {
      const origin = new URL('/', window.location.origin).toString();
      const challenge = await requestSiweChallenge({ domain: window.location.host, uri: origin, chainId: selectedChain.id });
      const message = buildSiweMessage({ address, chainId: selectedChain.id, nonce: challenge.nonce, expiresAt: challenge.expiresAt, origin });
      const signature = await signMessageAsync({ message });
      const authenticated = await authenticateSiwe(message, signature, address);
      setSessionClock(Math.floor(Date.now() / 1_000));
      setSession(authenticated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'OPERATOR_SIGN_IN_FAILED');
    }
  }

  const value = useMemo<OperatorContextValue>(() => ({
    address,
    session,
    isConnected,
    wrongChain,
    writeEnabled: Boolean(isConnected && !wrongChain && sessionActive && operatorProfile.configured),
    busy: connecting || switching || signing,
    error,
    connectors,
    connectWallet(connector) { setError(null); connect({ connector }); },
    disconnectWallet() { clearStoredSession(); setSession(null); disconnect(); },
    switchToSelectedChain() { setError(null); switchChain({ chainId: selectedChain.id }); },
    signIn,
  }), [address, connect, connecting, connectors, disconnect, error, isConnected, session, sessionActive, signing, switchChain, switching, wrongChain]);

  return <OperatorContext.Provider value={value}>{children}</OperatorContext.Provider>;
}

export function useOperator(): OperatorContextValue {
  const value = useContext(OperatorContext);
  if (!value) throw new Error('OPERATOR_PROVIDER_REQUIRED');
  return value;
}
