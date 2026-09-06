import { useMemo, useState, type FormEvent } from 'react';
import { type Address, type Hex } from 'viem';
import { useChainId, usePublicClient, useWriteContract } from 'wagmi';
import type { Hex32 } from '@iroa/protocol';
import { useOperator } from '../context/OperatorContext';
import { enrollNode, requestNodeChallenge } from '../lib/api';
import { assertSuccessfulReceipt, nodeRegistrationTypedData, nodeRegistryAbi, requireContract, trustLevelCode } from '../lib/contracts';
import { t, type Locale } from '../lib/i18n';
import { Icon } from '../components/Icon';

type EnrollmentStage = 'form' | 'challenge' | 'complete';
const ZERO_BYTES32 = `0x${'00'.repeat(32)}`;
export const DEFAULT_POLICY_VERSION = '1.0.0';

async function deriveNodeId(operatorAddress: Address, deviceKeyHash: Hex32): Promise<Hex32> {
  const bytes = new TextEncoder().encode(`${operatorAddress.toLowerCase()}:${deviceKeyHash}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return `0x${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}` as Hex32;
}

function errorText(locale: Locale, cause: unknown): string {
  if (cause instanceof Error && cause.message.startsWith('CONTRACT_NOT_CONFIGURED')) return t(locale, 'manifestMissing');
  return t(locale, 'error');
}

export function Enrollment({ locale }: { locale: Locale }) {
  const operator = useOperator();
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const { writeContractAsync } = useWriteContract();
  const [deviceAddress, setDeviceAddress] = useState('');
  const [deviceKeyHash, setDeviceKeyHash] = useState('');
  const [trustLevel, setTrustLevel] = useState<'N0' | 'N1' | 'N2' | 'N3'>('N0');
  const [policyVersion, setPolicyVersion] = useState(DEFAULT_POLICY_VERSION);
  const [challenge, setChallenge] = useState<{ nodeId: Hex32; nonce: string; expiresAt: number; message: string } | null>(null);
  const [deviceSignature, setDeviceSignature] = useState('');
  const [registrationSignature, setRegistrationSignature] = useState('');
  const [stage, setStage] = useState<EnrollmentStage>('form');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionHash, setTransactionHash] = useState<Hex | null>(null);
  const [onchainRegistered, setOnchainRegistered] = useState(false);

  const registrationPayload = useMemo(() => {
    if (!challenge || !operator.address || !operator.session) return '';
    try {
      const typedData = nodeRegistrationTypedData({
        chainId,
        registry: requireContract('nodeRegistry'),
        nodeId: challenge.nodeId,
        operatorWallet: operator.address,
        operatorIdHash: operator.session.actorIdHash,
        trustLevel,
      });
      return JSON.stringify(typedData, null, 2);
    } catch {
      return '';
    }
  }, [challenge, operator.address, operator.session, chainId, trustLevel]);

  const challengeExpired = useMemo(
    () => Boolean(challenge && challenge.expiresAt <= Math.floor(Date.now() / 1_000)),
    [challenge],
  );

  async function createChallenge(event: FormEvent) {
    event.preventDefault();
    if (!operator.address) return;
    setBusy(true);
    setError(null);
    try {
      const nodeId = await deriveNodeId(operator.address, deviceKeyHash as Hex32);
      const issued = await requestNodeChallenge(nodeId, deviceAddress);
      if (!issued.message) throw new Error('NODE_CHALLENGE_MESSAGE_MISSING');
      setChallenge({ nodeId, nonce: issued.nonce, expiresAt: issued.expiresAt, message: issued.message });
      setStage('challenge');
      setDeviceSignature('');
      setRegistrationSignature('');
      setOnchainRegistered(false);
      setTransactionHash(null);
    } catch (cause) {
      setError(errorText(locale, cause));
    } finally {
      setBusy(false);
    }
  }

  async function completeEnrollment(event: FormEvent) {
    event.preventDefault();
    if (!challenge || !operator.address || !operator.session || !publicClient || challengeExpired) return;
    setBusy(true);
    setError(null);
    try {
      let registered = onchainRegistered;
      if (!registered) {
        const registry = requireContract('nodeRegistry');
        const existingNodeId = await publicClient.readContract({
          address: registry,
          abi: nodeRegistryAbi,
          functionName: 'deviceKeyNode',
          args: [deviceKeyHash as Hex32],
        });
        if (existingNodeId !== ZERO_BYTES32) {
          if (existingNodeId.toLowerCase() !== challenge.nodeId.toLowerCase()) throw new Error('DEVICE_KEY_ALREADY_BOUND');
          const [existingWallet, existingActorHash] = await Promise.all([
            publicClient.readContract({ address: registry, abi: nodeRegistryAbi, functionName: 'operatorWallet', args: [challenge.nodeId] }),
            publicClient.readContract({ address: registry, abi: nodeRegistryAbi, functionName: 'operatorIdHash', args: [challenge.nodeId] }),
          ]);
          if (existingWallet.toLowerCase() !== operator.address.toLowerCase()
            || existingActorHash.toLowerCase() !== operator.session.actorIdHash.toLowerCase()) {
            throw new Error('ONCHAIN_NODE_OWNER_MISMATCH');
          }
          registered = true;
          setOnchainRegistered(true);
        }
      }
      if (!registered) {
        const hash = await writeContractAsync({
          address: requireContract('nodeRegistry'),
          abi: nodeRegistryAbi,
          functionName: 'registerNode',
          args: [challenge.nodeId, operator.session.actorIdHash, deviceKeyHash as Hex32, trustLevelCode(trustLevel), registrationSignature as Hex],
        });
        assertSuccessfulReceipt(await publicClient.waitForTransactionReceipt({ hash }));
        setTransactionHash(hash);
        setOnchainRegistered(true);
      }
      await enrollNode({
        deviceAddress,
        deviceKeyHash: deviceKeyHash as Hex32,
        trustLevel,
        policyVersion,
        challengeNonce: challenge.nonce,
        deviceSignature,
      });
      setStage('complete');
    } catch (cause) {
      setError(errorText(locale, cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className="portal-main">
      <p className="eyebrow">{t(locale, 'navEnrollment')}</p>
      <h1 tabIndex={-1}>{t(locale, 'enrollmentTitle')}</h1>
      <p className="lead">{t(locale, 'enrollmentLead')}</p>

      {stage === 'complete' ? (
        <section className="success-panel" aria-live="polite">
          <Icon name="check" />
          <div><h2>{t(locale, 'registered')}</h2><p>{challenge?.nodeId}</p></div>
        </section>
      ) : stage === 'form' ? (
        <form className="form-card" onSubmit={(event) => void createChallenge(event)}>
          <div className="form-grid">
            <label>{t(locale, 'deviceAddress')}<input required pattern="0x[0-9a-fA-F]{40}" value={deviceAddress} onChange={(event) => setDeviceAddress(event.target.value)} autoComplete="off" /></label>
            <label>{t(locale, 'deviceKeyHash')}<input required pattern="0x[0-9a-fA-F]{64}" value={deviceKeyHash} onChange={(event) => setDeviceKeyHash(event.target.value)} autoComplete="off" /></label>
            <label>{t(locale, 'trustLevel')}<select value={trustLevel} onChange={(event) => setTrustLevel(event.target.value as typeof trustLevel)}><option>N0</option><option>N1</option><option>N2</option><option>N3</option></select></label>
            <label>{t(locale, 'policyVersion')}<input required pattern="[1-9][0-9]*\.[0-9]+\.[0-9]+" value={policyVersion} onChange={(event) => setPolicyVersion(event.target.value)} /></label>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" type="submit" disabled={busy || !operator.writeEnabled}>{busy ? t(locale, 'loading') : t(locale, 'createChallenge')}</button>
        </form>
      ) : (
        <form className="form-card" onSubmit={(event) => void completeEnrollment(event)}>
          <div className="step-label">2 / 2</div>
          <label>{t(locale, 'challengeMessage')}<textarea readOnly rows={6} value={challenge?.message ?? ''} /></label>
          <p className="field-help">{new Date((challenge?.expiresAt ?? 0) * 1_000).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US')}</p>
          <label>{t(locale, 'deviceSignature')}<input required pattern="0x[0-9a-fA-F]{130}" value={deviceSignature} onChange={(event) => setDeviceSignature(event.target.value)} autoComplete="off" /></label>
          {!onchainRegistered && <>
            <label>{t(locale, 'registrationPayload')}<textarea readOnly rows={10} value={registrationPayload} /></label>
            <label>{t(locale, 'registrationSignature')}<input required pattern="0x[0-9a-fA-F]{130}" value={registrationSignature} onChange={(event) => setRegistrationSignature(event.target.value)} autoComplete="off" /></label>
          </>}
          {onchainRegistered && <p className="inline-success"><Icon name="check" />{locale === 'ko' ? '온체인 등록 완료 · 포털 연결만 다시 시도합니다.' : 'Onchain registration complete · only the portal connection will be retried.'}</p>}
          {challengeExpired && <p className="form-error" role="alert">{locale === 'ko' ? '일회용 서명 요청이 만료되었습니다. 새로 만들어 주세요.' : 'The one-time signing request expired. Create a new one.'}</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="button-row">
            <button className="secondary-button" type="button" disabled={busy} onClick={() => setStage('form')}>{t(locale, 'cancel')}</button>
            <button className="primary-button" type="submit" disabled={busy || !operator.writeEnabled || challengeExpired}>{busy ? t(locale, 'registering') : t(locale, 'register')}</button>
          </div>
          {transactionHash && <details><summary>{t(locale, 'transaction')}</summary><code className="hash-value">{transactionHash}</code></details>}
        </form>
      )}
    </main>
  );
}
