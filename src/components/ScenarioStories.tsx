import type { ScenarioStory } from '../types/home';
import { getStatusLabel } from '../lib/content/status';
import { SectionIntro } from './SectionIntro';

export function ScenarioStories({ stories }: { stories: ScenarioStory[] }) {
  return (
    <section className="section scenarios" id="scenarios" aria-label="실제 활용 시나리오">
      <div className="section__inner">
        <SectionIntro
          eyebrow="REAL-LIFE SCENARIOS"
          title="기능을 나열하는 대신, 한 사람의 하루가 어떻게 달라지는지 보여줍니다."
          lead="각 장면은 IROA가 지향하는 목표 경험입니다. 실제 운영 여부와 제휴 관계는 검증된 상태에 따라 별도로 표시합니다."
        />

        <div className="scenario-grid">
          {stories.map((story, index) => (
            <article className="scenario-card" key={story.title} data-featured={index === 0 || undefined}>
              <div className="scenario-card__image">
                <img src={story.imageUrl} alt={story.imageAlt} width="1880" height="1253" loading="lazy" />
              </div>
              <div className="scenario-card__body">
                <span className="status-badge">{getStatusLabel(story.status)}</span>
                <h3>{story.title}</h3>
                <blockquote>{story.quote}</blockquote>
                <p>{story.description}</p>
                <ol aria-label={`${story.title} 흐름`}>
                  {story.flow.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
