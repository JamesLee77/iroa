import { useEffect, useState } from 'react';
import wordmarkUrl from '../../docs/brand/masters/wordmark/iroa-wordmark-color.svg?url';
import { sandboxConfig } from './lib/config';
import { getInitialLocale, setStoredLocale, translate, type Locale } from './lib/i18n';
import { Icon } from './components/Icon';
import { NewTask } from './pages/NewTask';
import { TaskStatus } from './pages/TaskStatus';
import { ResultConfirmation } from './pages/ResultConfirmation';
import { Dispute } from './pages/Dispute';

function currentPath(): string {
  return window.location.pathname.replace(/\/$/, '') || '/';
}

function Route({ path, locale }: { path: string; locale: Locale }) {
  const result = /^\/tasks\/(0x[0-9a-fA-F]{64})\/result$/.exec(path);
  if (result?.[1]) return <ResultConfirmation taskId={result[1]} locale={locale} />;
  const dispute = /^\/tasks\/(0x[0-9a-fA-F]{64})\/dispute$/.exec(path);
  if (dispute?.[1]) return <Dispute taskId={dispute[1]} locale={locale} />;
  const status = /^\/tasks\/(0x[0-9a-fA-F]{64})$/.exec(path);
  if (status?.[1]) return <TaskStatus taskId={status[1]} locale={locale} />;
  return <NewTask locale={locale} />;
}

export default function App() {
  const [locale, setLocale] = useState<Locale>(() => getInitialLocale());
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    setStoredLocale(locale);
  }, [locale]);

  useEffect(() => {
    const handlePopState = () => setPath(currentPath());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    window.requestAnimationFrame(() => document.querySelector<HTMLElement>('main h1')?.focus());
  }, [path]);

  return (
    <>
      <a className="skip-link" href="#main">{translate(locale, 'skip')}</a>
      <div className="environment-bar" role="status">
        <div className="container environment-bar__inner">
          <span><Icon name="shield" />{translate(locale, 'privateEnvironment')}</span>
          <strong>{translate(locale, 'noPublicTrading')}</strong>
          <span className="environment-bar__detail">{sandboxConfig.networkName} · Chain {sandboxConfig.chainId}</span>
        </div>
      </div>
      <header className="app-header">
        <div className="container app-header__inner">
          <a className="brand" href="/" aria-label="IROA sandbox home">
            <img src={wordmarkUrl} alt="IROA.AI" width="600" height="180" />
            <span>{translate(locale, 'appName')}</span>
          </a>
          <nav aria-label={translate(locale, 'appName')}>
            <a href="/">{translate(locale, 'newRequest')}</a>
            <button className="language-button" type="button" onClick={() => setLocale(locale === 'ko' ? 'en' : 'ko')}>
              {translate(locale, 'language')}
            </button>
          </nav>
        </div>
      </header>
      <div className="privacy-banner">
        <div className="container"><Icon name="warning" /><span>{translate(locale, 'environmentNotice')}</span></div>
      </div>
      <Route path={path} locale={locale} />
      <footer className="app-footer">
        <div className="container">
          <span>IROA.AI</span>
          <span>{translate(locale, 'privateEnvironment')} · {sandboxConfig.profile}</span>
        </div>
      </footer>
    </>
  );
}
