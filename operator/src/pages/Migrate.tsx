import { useEffect, useMemo, useState } from 'react';
import type { Hex } from 'viem';
import { usePublicClient, useWriteContract } from 'wagmi';
import { Icon } from '../components/Icon';
import { useOperator } from '../context/OperatorContext';
import { assertSuccessfulReceipt, formatIroa, migrationAbi, migrationConfigured, parseIroaAmount, requireContract, tokenAbi } from '../lib/contracts';
import { t, type Locale } from '../lib/i18n';

interface MigrationState {
  v1Balance: bigint;
  v2Balance: bigint;
  allowance: bigint;
  v1Supply: bigint;
  v2Supply: bigint;
  burned: bigint;
  minted: bigint;
}

const EMPTY_STATE: MigrationState = { v1Balance: 0n, v2Balance: 0n, allowance: 0n, v1Supply: 0n, v2Supply: 0n, burned: 0n, minted: 0n };

export function Migrate({ locale }: { locale: Locale }) {
  const operator = useOperator();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const configured = migrationConfigured();
  const [state, setState] = useState<MigrationState>(EMPTY_STATE);
  const [amountInput, setAmountInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<'approve' | 'migrate' | null>(null);
  const [error, setError] = useState(false);
  const [transactions, setTransactions] = useState<{ approve?: Hex; migrate?: Hex }>({});

  const amount = useMemo(() => {
    try { return parseIroaAmount(amountInput); } catch { return null; }
  }, [amountInput]);
  const amountAvailable = amount !== null && amount <= state.v1Balance;
  const allowanceReady = amount !== null && state.allowance >= amount;

  async function refresh() {
    if (!operator.address || !publicClient || !configured) return;
    setLoading(true);
    setError(false);
    try {
      const tokenV1 = requireContract('tokenV1');
      const tokenV2 = requireContract('tokenV2');
      const migration = requireContract('migration');
      const [v1Balance, v2Balance, allowance, v1Supply, v2Supply, burned, minted] = await Promise.all([
        publicClient.readContract({ address: tokenV1, abi: tokenAbi, functionName: 'balanceOf', args: [operator.address] }),
        publicClient.readContract({ address: tokenV2, abi: tokenAbi, functionName: 'balanceOf', args: [operator.address] }),
        publicClient.readContract({ address: tokenV1, abi: tokenAbi, functionName: 'allowance', args: [operator.address, migration] }),
        publicClient.readContract({ address: tokenV1, abi: tokenAbi, functionName: 'totalSupply' }),
        publicClient.readContract({ address: tokenV2, abi: tokenAbi, functionName: 'totalSupply' }),
        publicClient.readContract({ address: migration, abi: migrationAbi, functionName: 'migrationBurned' }),
        publicClient.readContract({ address: migration, abi: migrationAbi, functionName: 'migrationMinted' }),
      ]);
      setState({ v1Balance, v2Balance, allowance, v1Supply, v2Supply, burned, minted });
    } catch { setError(true); } finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, [operator.address, configured]);

  async function approve() {
    if (!amount || !publicClient) return;
    setBusyAction('approve');
    setError(false);
    try {
      const hash = await writeContractAsync({ address: requireContract('tokenV1'), abi: tokenAbi, functionName: 'approve', args: [requireContract('migration'), amount] });
      assertSuccessfulReceipt(await publicClient.waitForTransactionReceipt({ hash }));
      setTransactions((current) => ({ ...current, approve: hash }));
      await refresh();
    } catch { setError(true); } finally { setBusyAction(null); }
  }

  async function migrate() {
    if (!amount || !publicClient || !operator.address) return;
    setBusyAction('migrate');
    setError(false);
    try {
      const { request } = await publicClient.simulateContract({ account: operator.address, address: requireContract('migration'), abi: migrationAbi, functionName: 'migrate', args: [amount] });
      const hash = await writeContractAsync(request);
      assertSuccessfulReceipt(await publicClient.waitForTransactionReceipt({ hash }));
      setTransactions((current) => ({ ...current, migrate: hash }));
      setAmountInput('');
      await refresh();
    } catch { setError(true); } finally { setBusyAction(null); }
  }

  return (
    <main id="main" className="portal-main">
      <div className="page-heading"><div><p className="eyebrow">{t(locale, 'navMigrate')}</p><h1 tabIndex={-1}>{t(locale, 'migrateTitle')}</h1><p className="lead">{t(locale, 'migrateLead')}</p></div>{configured && <button className="secondary-button" type="button" disabled={loading} onClick={() => void refresh()}><Icon name="refresh" />{t(locale, 'refresh')}</button>}</div>
      {!configured ? <section className="empty-state inline-alert"><Icon name="warning" />{t(locale, 'migrationUnavailable')}</section> : (
        <>
          <section className="balance-grid" aria-live="polite"><div><span>{t(locale, 'v1Balance')}</span><strong>{formatIroa(state.v1Balance)} IROA</strong></div><div><span>{t(locale, 'v2Balance')}</span><strong>{formatIroa(state.v2Balance)} IROA</strong></div></section>
          <section className="form-card">
            <label>{t(locale, 'amountInput')}<div className="amount-field"><input inputMode="decimal" placeholder="0.0" value={amountInput} onChange={(event) => setAmountInput(event.target.value)} /><span>IROA</span></div></label>
            <p className="field-help">{t(locale, 'partialHelp')}</p>
            {amountInput && !amount && <p className="form-error" role="alert">{locale === 'ko' ? '소수점 18자리 이내의 올바른 수량을 입력해 주세요.' : 'Enter a valid amount with no more than 18 decimal places.'}</p>}
            {amount && !amountAvailable && <p className="form-error" role="alert">{locale === 'ko' ? 'V1 잔액보다 큰 수량입니다.' : 'The amount exceeds your V1 balance.'}</p>}
            {error && <p className="form-error" role="alert">{t(locale, 'error')}</p>}
            <div className="migration-steps"><div className={allowanceReady ? 'migration-step is-complete' : 'migration-step'}><span>1</span><div><strong>{allowanceReady ? t(locale, 'allowanceReady') : t(locale, 'allowanceNeeded')}</strong><button className="secondary-button" type="button" disabled={!operator.writeEnabled || !amountAvailable || busyAction !== null} onClick={() => void approve()}>{busyAction === 'approve' ? t(locale, 'approving') : t(locale, 'approve')}</button></div></div><div className="migration-step"><span>2</span><div><strong>{t(locale, 'migrate')}</strong><button className="primary-button" type="button" disabled={!operator.writeEnabled || !amountAvailable || !allowanceReady || busyAction !== null} onClick={() => void migrate()}>{busyAction === 'migrate' ? t(locale, 'migrating') : t(locale, 'migrate')}</button></div></div></div>
          </section>
          <section className="supply-panel"><h2>{locale === 'ko' ? '공급량 검증' : 'Supply verification'}</h2><dl className="metric-grid"><div><dt>{t(locale, 'burned')}</dt><dd>{formatIroa(state.burned)}</dd></div><div><dt>{t(locale, 'minted')}</dt><dd>{formatIroa(state.minted)}</dd></div><div><dt>{t(locale, 'combinedSupply')}</dt><dd>{formatIroa(state.v1Supply + state.v2Supply)}</dd></div></dl></section>
          {(transactions.approve || transactions.migrate) && <details open><summary>{t(locale, 'transaction')}</summary><dl className="technical-list">{transactions.approve && <div><dt>{t(locale, 'approve')}</dt><dd><code>{transactions.approve}</code></dd></div>}{transactions.migrate && <div><dt>{t(locale, 'migrate')}</dt><dd><code>{transactions.migrate}</code></dd></div>}</dl></details>}
        </>
      )}
    </main>
  );
}
