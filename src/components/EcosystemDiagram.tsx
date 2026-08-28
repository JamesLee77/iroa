import type { EcosystemLayer } from '../types/home';
import { getStatusLabel } from '../lib/content/status';
import { SectionIntro } from './SectionIntro';

export function EcosystemDiagram({ layers }: { layers: EcosystemLayer[] }) {
  return (
    <section className="section ecosystem" id="ecosystem" aria-label="IROA 생태계">
      <div className="section__inner">
        <SectionIntro
          eyebrow="IROA ECOSYSTEM"
          title="하나의 두뇌가 다양한 접점과 현실의 실행자를 연결합니다."
          lead="제품을 따로 나열하지 않고 사용자의 접점, Agent, 안전 코어, 현실 실행 네트워크, 정산이 어떻게 하나의 요청을 이어받는지 보여줍니다."
        />

        <ol className="ecosystem-stack" aria-label="IROA 생태계 계층">
          {layers.map((layer, index) => (
            <li className="ecosystem-layer" key={layer.title}>
              <span className="ecosystem-layer__index" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="ecosystem-layer__copy">
                <h3>{layer.title}</h3>
                <p>{layer.description}</p>
              </div>
              <ul className="ecosystem-layer__items" aria-label={`${layer.title} 구성`}>
                {layer.items.map((item) => (
                  <li key={item}>
                    <span>{item}</span>
                    {layer.status && (item === 'Robot' || item === 'Circle Native USDC') ? (
                      <small>{getStatusLabel(layer.status)}</small>
                    ) : null}
                  </li>
                ))}
              </ul>
              {index < layers.length - 1 ? <span className="ecosystem-layer__connector" aria-hidden="true" /> : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
