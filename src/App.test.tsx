import { render, screen } from '@testing-library/react';
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
