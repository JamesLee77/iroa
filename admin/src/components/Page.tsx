import type { ReactNode } from 'react';
import { Icon } from './Icon';

export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1 tabIndex={-1}>{title}</h1><p className="lead">{description}</p></div>{action}</div>;
}

export function LoadingState({ label = '정보를 불러오는 중입니다.' }: { label?: string }) {
  return <div className="loading-state" role="status"><span className="spinner" aria-hidden="true" />{label}</div>;
}

export function ErrorState({ error }: { error: unknown }) {
  return <p className="inline-error" role="alert"><Icon name="warning" />{error instanceof Error ? error.message : '정보를 불러오지 못했습니다.'}</p>;
}

export function StatusChip({ status }: { status: string }) {
  return <span className={`status-chip status-${status}`}><span aria-hidden="true" className="status-dot" />{status.replaceAll('_', ' ')}</span>;
}

export function ShortHash({ value }: { value: string }) {
  return <code title={value}>{value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value}</code>;
}

export function WriteLock({ allowed, roleLabel }: { allowed: boolean; roleLabel: string }) {
  if (allowed) return <p className="inline-success"><Icon name="check" />Cloudflare Access, SIWE, 네트워크 및 {roleLabel} 권한 확인 완료</p>;
  return <p className="inline-alert"><Icon name="shield" />이 작업은 Cloudflare Access, SIWE 로그인, 올바른 네트워크와 {roleLabel} 온체인 권한이 모두 필요합니다.</p>;
}
