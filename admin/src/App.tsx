import { useEffect } from 'react';
import wordmarkUrl from '../../docs/brand/masters/wordmark/iroa-wordmark-color.svg?url';
import { Icon, type IconName } from './components/Icon';
import { useAdmin } from './context/AdminContext';
import { Audit } from './pages/Audit';
import { Disputes } from './pages/Disputes';
import { Governance } from './pages/Governance';
import { Nodes } from './pages/Nodes';
import { Settlement } from './pages/Settlement';
import { canViewRoute, defaultRoute, PERSONA_LABEL, type AdminRoute } from './lib/personas';
import { adminProfile, selectedChain } from './lib/wagmi';

const ROUTES: readonly { path: AdminRoute; label: string; icon: IconName }[] = [
  { path: '/nodes', label: 'NODE', icon: 'node' },
  { path: '/disputes', label: '분쟁', icon: 'dispute' },
  { path: '/settlement', label: '정산', icon: 'settlement' },
  { path: '/governance', label: 'Governance', icon: 'governance' },
  { path: '/audit', label: '감사 기록', icon: 'audit' },
];

function currentPath(): AdminRoute {
  const path = window.location.pathname.replace(/\/$/, '') || '/nodes';
  return (ROUTES.some((route) => route.path === path) ? path : '/nodes') as AdminRoute;
}

function WalletGate() {
  const admin = useAdmin();
  if (!admin.identity.accessVerified) return <div className="identity-locked"><Icon name="shield" /><div><strong>Cloudflare Access 인증 필요</strong><span>승인된 내부 사용자만 관리자 콘솔에 접근할 수 있습니다.</span></div></div>;
  if (!admin.isConnected) return <div className="wallet-actions"><p>관리자 지갑을 연결하세요.</p>{admin.connectors.map((connector) => <button className="primary-button" type="button" key={connector.uid} disabled={admin.busy} onClick={() => admin.connectWallet(connector)}><Icon name="wallet" />{connector.name} 연결</button>)}</div>;
  if (admin.wrongChain) return <div className="wallet-actions"><p>선택된 배포 네트워크와 지갑 네트워크가 다릅니다.</p><button className="primary-button" type="button" disabled={admin.busy} onClick={admin.switchChain}>올바른 네트워크로 전환</button></div>;
  if (!admin.session) return <div className="wallet-actions"><p>{admin.address?.slice(0, 6)}…{admin.address?.slice(-4)}</p><button className="primary-button" type="button" disabled={admin.busy} onClick={() => void admin.signIn()}>관리자 서명 로그인</button></div>;
  return <div className="wallet-actions"><p><strong>{admin.address?.slice(0, 6)}…{admin.address?.slice(-4)}</strong><span>SIWE 확인됨</span></p><button className="text-button" type="button" onClick={admin.disconnectWallet}>연결 해제</button></div>;
}

function AccessDenied({ path }: { path: AdminRoute }) {
  const admin = useAdmin();
  const destination = defaultRoute(admin.identity.persona);
  return <main id="main" className="portal-main gate-page"><Icon name="shield" /><p className="eyebrow">접근 제한</p><h1 tabIndex={-1}>이 화면을 볼 수 없습니다</h1><p className="lead">{PERSONA_LABEL[admin.identity.persona]} 권한에는 {path} 화면이 포함되지 않습니다. 주소를 직접 입력해도 같은 정책이 적용됩니다.</p><a className="primary-button" href={destination}>허용된 첫 화면으로 이동</a></main>;
}

export default function App() {
  const admin = useAdmin();
  const path = currentPath();
  const allowed = !admin.identityLoading && admin.identity.accessVerified && canViewRoute(admin.identity.persona, path);
  const visibleRoutes = admin.identityLoading ? [] : ROUTES.filter((route) => canViewRoute(admin.identity.persona, route.path));
  const page = path === '/disputes' ? <Disputes /> : path === '/settlement' ? <Settlement /> : path === '/governance' ? <Governance /> : path === '/audit' ? <Audit /> : <Nodes />;

  useEffect(() => { requestAnimationFrame(() => document.querySelector<HTMLElement>('main h1')?.focus()); }, [path, allowed]);

  return <>
    <a className="skip-link" href="#main">본문으로 바로가기</a>
    <div className="environment-bar"><div className="container"><span><Icon name="shield" />비공개 관리자 영역</span><strong>직접 자금 이동 없음 · Safe/Timelock 필수</strong><span>{selectedChain.name}</span></div></div>
    <header className="app-header"><div className="container app-header__inner"><a className="brand" href="/nodes"><img src={wordmarkUrl} alt="IROA.AI" width="600" height="180" /><span>Admin Console</span></a><div className="identity-summary"><span>{admin.identityLoading ? '권한 확인 중' : PERSONA_LABEL[admin.identity.persona]}</span><strong className={admin.identity.accessVerified ? 'status-ready' : 'status-locked'}>{admin.identity.accessVerified ? 'Access 확인됨' : 'Access 잠김'}</strong></div></div></header>
    <div className="container portal-layout">
      <aside className="portal-sidebar">
        <section className="wallet-panel" aria-label="관리자 인증"><WalletGate />{admin.error && <p className="form-error" role="alert">{admin.error}</p>}</section>
        <nav aria-label="관리자 메뉴">{visibleRoutes.map((route) => <a key={route.path} href={route.path} aria-current={path === route.path ? 'page' : undefined}><Icon name={route.icon} />{route.label}</a>)}</nav>
        <div className="build-status"><span>배포 프로필</span><strong>{adminProfile.profile}</strong><span className={adminProfile.configured ? 'status-ready' : 'status-locked'}>{adminProfile.configured ? 'manifest 확인됨' : 'manifest 필요'}</span></div>
      </aside>
      {admin.identityLoading ? <main id="main" className="portal-main"><div className="loading-state" role="status"><span className="spinner" />접근 권한을 확인하는 중입니다.</div></main> : allowed ? <div className="page-column">{admin.identity.persona === 'read_only' && <p className="read-only-banner"><Icon name="shield" />읽기 전용 권한입니다. 모든 변경·제안·내보내기 기능이 잠겨 있습니다.</p>}{page}</div> : <AccessDenied path={path} />}
    </div>
  </>;
}
