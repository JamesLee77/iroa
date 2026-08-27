import type { HeroContent } from '../types/home';
import { ArrowRightIcon, CheckIcon } from './icons';

export function Hero({ content }: { content: HeroContent }) {
  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="hero__inner">
        <div className="hero__copy">
          <p className="eyebrow">{content.eyebrow}</p>
          <h1 id="hero-title">{content.title}</h1>
          <p className="hero__description">{content.description}</p>
          <div className="hero__actions">
            <a className="button" href={content.primaryCta.href}>
              {content.primaryCta.label}
              <ArrowRightIcon />
            </a>
            <a className="button button--secondary" href={content.secondaryCta.href}>
              {content.secondaryCta.label}
            </a>
          </div>
        </div>

        <figure className="hero__visual">
          <div className="hero__image-frame">
            <img src={content.imageUrl} alt={content.imageAlt} width="1880" height="1253" />
          </div>
          <figcaption className="hero__completion-card">
            <span className="hero__completion-mark"><CheckIcon /></span>
            <span>
              <strong>요청이 결과로 이어질 때까지</strong>
              <small>접수 · 연결 · 실행 · 완료 확인</small>
            </span>
          </figcaption>
        </figure>
      </div>

      <ul className="hero__trust" aria-label="IROA 신뢰 원칙">
        {content.trust.map((item) => (
          <li key={item}>
            <CheckIcon />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
