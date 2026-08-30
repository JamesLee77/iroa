import type { Locale } from '../lib/i18n';
import { t } from '../lib/i18n';
import { operatorProfile, selectedChain } from '../lib/wagmi';
import { useOperator } from '../context/OperatorContext';
import { Icon } from './Icon';

function compact(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletPanel({ locale }: { locale: Locale }) {
  const operator = useOperator();
  return (
    <section className="wallet-panel" aria-labelledby="wallet-heading">
      <div>
        <p className="panel-label" id="wallet-heading"><Icon name="wallet" />{t(locale, 'wallet')}</p>
        <strong>{operator.address ? compact(operator.address) : selectedChain.name}</strong>
        <span className="wallet-panel__network">{selectedChain.name} · {operatorProfile.chainId}</span>
      </div>
      <div className="wallet-panel__actions">
        {!operator.isConnected && operator.connectors.map((connector) => (
          <button key={connector.uid} className="primary-button" type="button" disabled={operator.busy} onClick={() => operator.connectWallet(connector)}>
            {operator.busy ? t(locale, 'connecting') : t(locale, 'connect')}
          </button>
        ))}
        {operator.wrongChain && (
          <button className="danger-button" type="button" disabled={operator.busy} onClick={operator.switchToSelectedChain}>{t(locale, 'switchChain')}</button>
        )}
        {operator.isConnected && !operator.wrongChain && !operator.session && (
          <button className="primary-button" type="button" disabled={operator.busy} onClick={() => void operator.signIn()}>
            {operator.busy ? t(locale, 'signing') : t(locale, 'signIn')}
          </button>
        )}
        {operator.isConnected && <button className="text-button" type="button" onClick={operator.disconnectWallet}>{t(locale, 'disconnect')}</button>}
      </div>
      {operator.wrongChain && <p className="inline-alert" role="alert"><Icon name="warning" />{t(locale, 'wrongChain')}</p>}
      {!operatorProfile.configured && <p className="inline-alert"><Icon name="warning" />{t(locale, 'manifestMissing')}</p>}
      {operator.error && <p className="form-error" role="alert">{t(locale, 'error')}</p>}
    </section>
  );
}
