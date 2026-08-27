import type { SettlementContent } from '../types/home';
import { CheckIcon } from './icons';
import { SectionIntro } from './SectionIntro';

interface SettlementNetworkProps {
  settlement: SettlementContent;
}

export function SettlementNetwork({ settlement }: SettlementNetworkProps) {
  return (
    <section className="section settlement" id="network" aria-label="네트워크와 정산">
      <div className="section__inner">
        <SectionIntro
          eyebrow="NETWORK & SETTLEMENT"
          title={settlement.title}
          lead={settlement.description}
          inverse
        />

        <div className="settlement__legend" aria-label="선택된 정산 네트워크">
          <span>
            <small>PRIMARY NETWORK</small>
            <strong>{settlement.network}</strong>
          </span>
          <span>
            <small>SETTLEMENT ASSET</small>
            <strong>{settlement.asset}</strong>
          </span>
        </div>

        <ol className="settlement-flow" aria-label="사용자 결제부터 B2B 정산까지">
          {settlement.steps.map((step, index) => (
            <li key={step.title}>
              <span className="settlement-flow__index" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
              {index < settlement.steps.length - 1 ? <span className="settlement-flow__connector" aria-hidden="true" /> : null}
            </li>
          ))}
        </ol>

        <div className="settlement__principles">
          <p>{settlement.consumerPayment}</p>
          <ul>
            {settlement.principles.map((principle) => (
              <li key={principle}>
                <CheckIcon />
                <span>{principle}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
