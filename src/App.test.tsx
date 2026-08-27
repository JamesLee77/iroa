import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';
import { homeKo } from './content/home.ko';

describe('IROA homepage shell', () => {
  it('exposes one main landmark and the approved hero promise', () => {
    render(<App />);

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: '말로 요청하면, 현실의 일이 안전하게 완료됩니다.',
      }),
    ).toBeInTheDocument();
  });
});

describe('approved homepage content', () => {
  it('keeps the whitepaper request lifecycle in its approved order', () => {
    expect(homeKo.lifecycle.map((step) => step.title)).toEqual([
      '요청',
      '계획',
      '선택',
      '승인',
      '실행',
      '검증',
      '복구·사람 인계',
    ]);
  });

  it('separates Base USDC settlement from consumer payments', () => {
    expect(homeKo.settlement.network).toBe('Base');
    expect(homeKo.settlement.asset).toBe('Circle Native USDC');
    expect(homeKo.settlement.consumerPayment).toContain('원화');
    expect(homeKo.settlement.consumerPayment).toContain('카드');
  });
});

describe('header and hero navigation', () => {
  it('links the primary and secondary actions to existing homepage sections', () => {
    render(<App />);

    expect(screen.getByRole('navigation', { name: '주요 메뉴' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'IROA.AI 홈' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '기관 도입·PoC 상담' })).toHaveAttribute(
      'href',
      '#contact',
    );
    expect(screen.getByRole('link', { name: 'IROA 작동 방식 보기' })).toHaveAttribute(
      'href',
      '#how-it-works',
    );
  });

  it('opens and closes the mobile menu with button and Escape', () => {
    render(<App />);

    const menuButton = screen.getByRole('button', { name: '메뉴 열기' });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(menuButton);
    expect(screen.getByRole('button', { name: '메뉴 닫기' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('button', { name: '메뉴 열기' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});

describe('IROA request lifecycle', () => {
  it('renders all seven steps in whitepaper order with recovery last', () => {
    render(<App />);

    const region = screen.getByRole('region', { name: 'IROA 작동 방식' });
    const lifecycle = within(region).getByRole('list', { name: '요청 생명주기' });
    const steps = within(lifecycle).getAllByRole('listitem');

    expect(steps).toHaveLength(7);
    expect(within(steps.at(-1)!).getByRole('heading', { name: '복구·사람 인계' })).toBeInTheDocument();
  });

  it('explains the three protection rails', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: '사용자 통제' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '사람 연결' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '완료 책임' })).toBeInTheDocument();
  });
});
