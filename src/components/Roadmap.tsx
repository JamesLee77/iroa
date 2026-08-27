import type { RoadmapPhase } from '../types/home';
import { SectionIntro } from './SectionIntro';

export function Roadmap({ phases }: { phases: RoadmapPhase[] }) {
  return (
    <section className="section roadmap" id="roadmap" aria-label="IROA 로드맵">
      <div className="section__inner">
        <SectionIntro
          eyebrow="ROADMAP"
          title="약속보다 검증을 먼저 쌓는 단계적 로드맵"
          lead="현재 완료된 기반과 다음 검증, 계획된 정산, 장기 네트워크를 같은 상태처럼 말하지 않습니다. 각 단계는 앞 단계의 현장 근거를 통과한 뒤 진행합니다."
        />

        <ol className="roadmap-list">
          {phases.map((phase, index) => (
            <li key={phase.title}>
              <div className="roadmap-list__rail" aria-hidden="true">
                <span>{String(index + 1).padStart(2, '0')}</span>
              </div>
              <article>
                <span className="status-badge" data-testid="roadmap-status">
                  {phase.status}
                </span>
                <h3>{phase.title}</h3>
                <p>{phase.description}</p>
                <small>{phase.evidence}</small>
              </article>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
