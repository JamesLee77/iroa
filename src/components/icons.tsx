import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const iconDefaults = {
  'aria-hidden': true,
  fill: 'none',
  focusable: false,
  viewBox: '0 0 24 24',
} as const;

export function MenuIcon(props: IconProps) {
  return (
    <svg {...iconDefaults} {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...iconDefaults} {...props}>
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...iconDefaults} {...props}>
      <path d="M5 12h14m-5-5 5 5-5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...iconDefaults} {...props}>
      <path d="m5 12 4.2 4.2L19 6.8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}
