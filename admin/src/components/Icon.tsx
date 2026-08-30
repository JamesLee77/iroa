import type { ReactNode, SVGProps } from 'react';

export type IconName = 'node' | 'dispute' | 'settlement' | 'governance' | 'audit' | 'shield' | 'warning' | 'check' | 'download' | 'wallet';
const paths: Record<IconName, ReactNode> = {
  node: <><circle cx="12" cy="12" r="3" /><circle cx="12" cy="3.5" r="1.5" /><circle cx="4.5" cy="17" r="1.5" /><circle cx="19.5" cy="17" r="1.5" /><path d="M12 8.5V5M9.5 14l-3.7 2.2M14.5 14l3.7 2.2" /></>,
  dispute: <><path d="M5 4h14v12H8l-3 3z" /><path d="M9 8h6M9 12h4" /></>,
  settlement: <><path d="M4 19h16M6 16V9m4 7V5m4 11v-4m4 4V7" /></>,
  governance: <><path d="M3 21h18M5 18h14M7 18V9m5 9V9m5 9V9M4 7h16L12 3z" /></>,
  audit: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  shield: <><path d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>,
  warning: <><path d="M12 3 2.5 20h19z" /><path d="M12 9v4M12 17h.01" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
  download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" /></>,
  wallet: <><path d="M3 6h16a2 2 0 0 1 2 2v10H3z" /><path d="M3 6V4h14v2M16 12h5" /></>,
};
export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>{paths[name]}</svg>;
}
