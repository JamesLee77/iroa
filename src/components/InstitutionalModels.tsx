import type { InstitutionModel } from '../types/home';
import { ArrowRightIcon } from './icons';
import { SectionIntro } from './SectionIntro';

const institutionFlow = [
  ['사용자·보호자', '요청과 승인'],
  ['IROA Orchestration', '계획·권한·상태 관리'],
  ['기관·현장 제공자·지역 서비스', '업무 수행과 사람 인계'],
  ['결과 확인·보고·정산', '완료 근거와 책임'],
] as const;

export function InstitutionalModels({ models }: { models: InstitutionModel[] }) {
  return (
    <section className="section institutions" id="institutions" aria-label="기관 도입 모델">
      <div className="section__inner">
        <SectionIntro
          eyebrow="INSTITUTIONAL ADOPTION"
          title="기관마다 다른 문제를, 하나의 실행 책임 구조로 연결합니다."
          lead="기존 시스템 전체를 바꾸는 대신 대상 사용자와 한 가지 현실 업무를 정해 요청·승인·실행·회복·완료를 함께 검증합니다."
          inverse
        />

        <ol className="institution-flow" aria-label="기관 도입 운영 흐름">
          {institutionFlow.map(([title, description], index) => (
            <li key={title}>
              <span className="institution-flow__index" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <strong>{title}</strong>
              <small>{description}</small>
              {index < institutionFlow.length - 1 ? <span className="institution-flow__connector" aria-hidden="true" /> : null}
            </li>
          ))}
        </ol>

        <div className="institution-models">
          {models.map((model) => (
            <article key={model.title}>
              <h3>{model.title}</h3>
              <p>{model.value}</p>
              <dl>
                <dt>첫 파일럿 예시</dt>
                <dd>{model.pilot}</dd>
              </dl>
            </article>
          ))}
        </div>

        <a className="button institutions__cta" href="#contact">
          우리 기관의 파일럿 모델 설계하기
          <ArrowRightIcon />
        </a>
      </div>
    </section>
  );
}
