import type { LifecycleStep, ProtectionRail } from '../types/home';
import { SectionIntro } from './SectionIntro';

interface OrchestrationFlowProps {
  steps: LifecycleStep[];
  protections: ProtectionRail[];
}

export function OrchestrationFlow({ steps, protections }: OrchestrationFlowProps) {
  return (
    <section
      className="section orchestration"
      id="how-it-works"
      aria-label="IROA 작동 방식"
    >
      <div className="section__inner">
        <SectionIntro
          eyebrow="HOW IROA WORKS"
          title="한 번의 요청이, 끝까지 이어지는 하나의 책임이 됩니다."
          lead="IROA는 답을 보여주는 데서 멈추지 않습니다. 사용자가 이해하고 승인한 범위 안에서 실제 결과를 만들고, 실패하면 다시 회복할 수 있는 흐름을 유지합니다."
        />

        <ol className="flow" aria-label="요청 생명주기">
          {steps.map((step, index) => (
            <li className="flow__step" key={step.title} data-recovery={index === steps.length - 1 || undefined}>
              <div className="flow__number" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
              {index < steps.length - 1 ? <span className="flow__connector" aria-hidden="true" /> : null}
            </li>
          ))}
        </ol>

        <div className="protection-rails" aria-label="실행 보호 장치">
          {protections.map((protection, index) => (
            <article key={protection.title}>
              <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <h3>{protection.title}</h3>
              <p>{protection.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
