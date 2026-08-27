import type { SafetyLayer } from '../types/home';
import { CheckIcon } from './icons';
import { SectionIntro } from './SectionIntro';

interface SafetyLayersProps {
  layers: SafetyLayer[];
  boundaries: string[];
}

export function SafetyLayers({ layers, boundaries }: SafetyLayersProps) {
  return (
    <section className="section safety" id="safety" aria-label="안전과 신뢰">
      <div className="section__inner">
        <SectionIntro
          eyebrow="SAFETY & TRUST"
          title="자동화보다 먼저, 사용자의 권한과 회복 가능성을 설계합니다."
          lead="IROA의 안전은 선언이 아니라 실행을 멈추고, 다시 묻고, 사람에게 넘기고, 결과를 확인하는 운영 구조입니다."
        />

        <div className="safety__layout">
          <div className="safety-stack">
            {layers.map((layer, index) => (
              <article key={layer.title}>
                <span className="safety-stack__number" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3>{layer.title}</h3>
                  <p>{layer.description}</p>
                </div>
              </article>
            ))}
          </div>

          <aside className="data-boundary" aria-label="데이터와 블록체인 경계">
            <p className="data-boundary__eyebrow">PUBLIC-CHAIN DATA BOUNDARY</p>
            <h3>검증 가능한 정산과 개인정보는 서로 다른 층에 둡니다.</h3>
            <ul>
              {boundaries.map((boundary) => (
                <li key={boundary}>
                  <CheckIcon />
                  <span>{boundary}</span>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </section>
  );
}
