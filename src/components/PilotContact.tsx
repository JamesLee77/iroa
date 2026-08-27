import type { ContactContent } from '../types/home';
import { ArrowRightIcon } from './icons';

interface PilotContactProps {
  contact: ContactContent;
  whitepaperUrl: string;
}

export function PilotContact({ contact, whitepaperUrl }: PilotContactProps) {
  return (
    <section className="section pilot-contact" id="contact" aria-label="기관 도입 문의">
      <div className="pilot-contact__inner">
        <div className="pilot-contact__copy">
          <p className="section-intro__eyebrow">START A PILOT</p>
          <h2>{contact.title}</h2>
          <p>{contact.description}</p>
        </div>

        <div className="pilot-contact__intake">
          <p>첫 대화에서 확인할 세 가지</p>
          <ol>
            {contact.intake.map((item, index) => (
              <li key={item}>
                <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <strong>{item}</strong>
              </li>
            ))}
          </ol>
          <div className="pilot-contact__channel" aria-label="문의 채널 상태">
            <span>{contact.channelLabel}</span>
            <small>{contact.privacyNotice}</small>
          </div>
          <a className="button button--secondary" href={whitepaperUrl} target="_blank" rel="noreferrer">
            IROA 백서 먼저 보기
            <ArrowRightIcon />
          </a>
        </div>
      </div>
    </section>
  );
}
