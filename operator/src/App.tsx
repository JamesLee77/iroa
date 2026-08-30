import { useEffect, useState } from 'react';
import wordmarkUrl from '../../docs/brand/masters/wordmark/iroa-wordmark-color.svg?url';
import { OperatorProvider, useOperator } from './context/OperatorContext';
import { Icon, type IconName } from './components/Icon';
import { WalletPanel } from './components/WalletPanel';
import { Enrollment } from './pages/Enrollment';
import { Nodes } from './pages/Nodes';
import { Tasks } from './pages/Tasks';
import { Rewards } from './pages/Rewards';
import { Migrate } from './pages/Migrate';
import { initialLocale, storeLocale, t, type Locale } from './lib/i18n';
import { operatorProfile, selectedChain } from './lib/wagmi';

const routes: readonly { path: string; key: 'navEnrollment' | 'navNodes' | 'navTasks' | 'navRewards' | 'navMigrate'; icon: IconName }[] = [
  { path: '/enrollment', key: 'navEnrollment', icon: 'node' },
  { path: '/nodes', key: 'navNodes', icon: 'shield' },
  { path: '/tasks', key: 'navTasks', icon: 'task' },
  { path: '/rewards', key: 'navRewards', icon: 'reward' },
  { path: '/migrate', key: 'navMigrate', icon: 'migrate' },
];

function pagePath(): string {
  const path = window.location.pathname.replace(/\/$/, '');
  return routes.some((route) => route.path === path) ? path : '/nodes';
}

function Portal({ locale, setLocale }: { locale: Locale; setLocale(locale: Locale): void }) {
  const operator = useOperator();
  const path = pagePath();
  const page = operator.session
    ? path === '/enrollment' ? <Enrollment locale={locale} />
      : path === '/tasks' ? <Tasks locale={locale} />
        : path === '/rewards' ? <Rewards locale={locale} />
          : path === '/migrate' ? <Migrate locale={locale} />
            : <Nodes locale={locale} />
    : null;

  useEffect(() => {
    requestAnimationFrame(() => document.querySelector<HTMLElement>('main h1')?.focus());
  }, [path, operator.session]);

  return (
    <>
      <a className="skip-link" href="#main">{t(locale, 'skip')}</a>
      <div className="environment-bar">
        <div className="container"><span><Icon name="shield" />{t(locale, 'private')}</span><strong>{t(locale, 'noTrading')}</strong><span>{selectedChain.name}</span></div>
      </div>
      <header className="app-header">
        <div className="container app-header__inner">
          <a className="brand" href="/nodes"><img src={wordmarkUrl} alt="IROA.AI" width="600" height="180" /><span>{t(locale, 'app')}</span></a>
          <button className="language-button" type="button" onClick={() => setLocale(locale === 'ko' ? 'en' : 'ko')}>{t(locale, 'language')}</button>
        </div>
      </header>
      <div className="container portal-layout">
        <aside className="portal-sidebar">
          <WalletPanel locale={locale} />
          <nav aria-label={t(locale, 'app')}>
            {routes.map((route) => <a key={route.path} href={route.path} aria-current={path === route.path ? 'page' : undefined}><Icon name={route.icon} />{t(locale, route.key)}</a>)}
          </nav>
          <div className="build-status"><span>{t(locale, 'network')}</span><strong>{operatorProfile.profile}</strong><span className={operator.writeEnabled ? 'status-ready' : 'status-locked'}>{operator.writeEnabled ? t(locale, 'writeReady') : t(locale, 'writeLocked')}</span></div>
        </aside>
        {page ?? (
          <main id="main" className="portal-main gate-page">
            <p className="eyebrow">{t(locale, 'private')}</p>
            <h1 tabIndex={-1}>{t(locale, 'app')}</h1>
            <p className="lead">{operator.isConnected ? t(locale, 'signIn') : t(locale, 'connect')}</p>
          </main>
        )}
      </div>
    </>
  );
}

export default function App() {
  const [locale, setLocale] = useState<Locale>(() => initialLocale());
  useEffect(() => storeLocale(locale), [locale]);
  return <OperatorProvider><Portal locale={locale} setLocale={setLocale} /></OperatorProvider>;
}
