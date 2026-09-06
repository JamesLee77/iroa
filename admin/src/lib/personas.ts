export type Persona = 'super_admin' | 'treasury' | 'compliance' | 'read_only';
export type AdminRoute = '/nodes' | '/disputes' | '/settlement' | '/governance' | '/audit';
export type AdminAction =
  | 'node:approve'
  | 'node:suspend'
  | 'node:reject'
  | 'node:trust-level'
  | 'dispute:resolve'
  | 'settlement:propose'
  | 'governance:export'
  | 'audit:export';

export const PERSONA_LABEL: Record<Persona, string> = {
  super_admin: '전체 관리자',
  treasury: '재무 운영자',
  compliance: '검증 운영자',
  read_only: '읽기 전용',
};

export const PERSONA_ROUTES: Record<Persona, readonly AdminRoute[]> = {
  super_admin: ['/nodes', '/disputes', '/settlement', '/governance', '/audit'],
  treasury: ['/settlement', '/governance', '/audit'],
  compliance: ['/nodes', '/disputes', '/audit'],
  read_only: ['/nodes', '/disputes', '/settlement', '/governance', '/audit'],
};

export const PERSONA_ACTIONS: Record<Persona, ReadonlySet<AdminAction>> = {
  super_admin: new Set(['node:approve', 'node:suspend', 'node:reject', 'node:trust-level', 'dispute:resolve', 'settlement:propose', 'governance:export', 'audit:export']),
  treasury: new Set(['settlement:propose', 'governance:export', 'audit:export']),
  compliance: new Set(['node:approve', 'node:suspend', 'node:reject', 'node:trust-level', 'dispute:resolve', 'audit:export']),
  read_only: new Set(),
};

export function isPersona(value: unknown): value is Persona {
  return value === 'super_admin' || value === 'treasury' || value === 'compliance' || value === 'read_only';
}

export function canViewRoute(persona: Persona, route: string): route is AdminRoute {
  return PERSONA_ROUTES[persona].includes(route as AdminRoute);
}

export function canPerform(persona: Persona, action: AdminAction): boolean {
  return PERSONA_ACTIONS[persona].has(action);
}

export function defaultRoute(persona: Persona): AdminRoute {
  return PERSONA_ROUTES[persona][0] ?? '/audit';
}
