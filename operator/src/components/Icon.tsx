import type { ReactNode, SVGProps } from 'react';

export type IconName = 'node' | 'task' | 'reward' | 'migrate' | 'wallet' | 'shield' | 'warning' | 'check' | 'refresh' | 'x';

const paths: Record<IconName, ReactNode> = {
  node: <><circle cx="12" cy="12" r="3" /><circle cx="12" cy="3.5" r="1.5" /><circle cx="4.5" cy="17" r="1.5" /><circle cx="19.5" cy="17" r="1.5" /><path d="M12 8.5V5M9.5 14l-3.7 2.2M14.5 14l3.7 2.2" /></>,
  task: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  reward: <><circle cx="12" cy="8" r="5" /><path d="m8.5 12-1 9 4.5-2 4.5 2-1-9" /></>,
  migrate: <><path d="M4 7h13l-3-3M20 17H7l3 3" /><path d="m17 7-3 3M7 17l3-3" /></>,
  wallet: <><path d="M3 6h16a2 2 0 0 1 2 2v10H3z" /><path d="M3 6V4h14v2M16 12h5" /></>,
  shield: <><path d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>,
  warning: <><path d="M12 3 2.5 20h19z" /><path d="M12 9v4M12 17h.01" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 8A7 7 0 0 1 19 12M17.9 16A7 7 0 0 1 5 12" /></>,
  x: <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6M15 9l-6 6" /></>,
};

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>{paths[name]}</svg>;
}
