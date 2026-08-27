import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import type { NavigationItem } from '../types/home';
import { CloseIcon, MenuIcon } from './icons';

interface SiteHeaderProps {
  navigation: NavigationItem[];
  wordmarkUrl: string;
}

export function SiteHeader({ navigation, wordmarkUrl }: SiteHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileNavRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isMenuOpen) {
        setIsMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isMenuOpen]);

  const closeMenu = () => setIsMenuOpen(false);

  const navigateFromMobileMenu = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    event.preventDefault();
    closeMenu();

    requestAnimationFrame(() => {
      const animations = mobileNavRef.current?.getAnimations?.() ?? [];
      void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
        window.history.pushState(null, '', href);
        document.querySelector(href)?.scrollIntoView();
      });
    });
  };

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a className="site-header__brand" href="#top" aria-label="IROA.AI 홈">
          <img src={wordmarkUrl} alt="IROA.AI 홈" />
        </a>

        <nav className="site-header__desktop-nav" aria-label="주요 메뉴">
          <ul>
            {navigation.slice(0, 5).map((item) => (
              <li key={item.href}>
                <a href={item.href}>{item.label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <a className="button button--compact site-header__cta" href="#contact">
          기관 도입
        </a>

        <button
          ref={menuButtonRef}
          className="site-header__menu-button"
          type="button"
          aria-controls="mobile-menu"
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
          onClick={() => setIsMenuOpen((current) => !current)}
        >
          {isMenuOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      <nav
        ref={mobileNavRef}
        id="mobile-menu"
        className="site-header__mobile-nav"
        aria-label="모바일 메뉴"
        aria-hidden={!isMenuOpen}
        data-open={isMenuOpen}
        inert={!isMenuOpen}
      >
        <ul>
          {navigation.map((item) => (
            <li key={item.href}>
              <a href={item.href} onClick={(event) => navigateFromMobileMenu(event, item.href)}>
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
