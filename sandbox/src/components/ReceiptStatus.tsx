import type { ReceiptSignal } from '../lib/api';
import type { Locale, TranslationKey } from '../lib/i18n';
import { translate } from '../lib/i18n';
import { Icon } from './Icon';

export function ReceiptStatus({ label, receipt, locale, reviewing = false }: { label: string; receipt: ReceiptSignal; locale: Locale; reviewing?: boolean }) {
  const present = receipt.status === 'verified';
  const statusKey: TranslationKey = reviewing ? 'reviewing' : present ? 'verified' : 'missing';
  return (
    <section className="receipt-card" aria-label={label}>
      <div className="receipt-card__heading">
        <Icon name={reviewing ? 'clock' : present ? 'check' : 'warning'} />
        <div>
          <h2>{label}</h2>
          <span className="receipt-card__status" data-status={reviewing ? 'reviewing' : receipt.status}>{translate(locale, statusKey)}</span>
        </div>
      </div>
      {receipt.receiptHash && (
        <details>
          <summary>{translate(locale, 'details')}</summary>
          <code>{receipt.receiptHash}</code>
        </details>
      )}
    </section>
  );
}
