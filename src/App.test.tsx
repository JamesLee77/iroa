import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';
import { homeKo } from './content/home.ko';

describe('retained IROA React consumer', () => {
  it('renders the current Network Atlas promise and both current actions', () => {
    render(<App />);

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: '현실 세계를 위한 검증 가능한 실행 네트워크.',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '네트워크 살펴보기' })).toHaveAttribute(
      'href',
      '#protocol',
    );
    expect(screen.getByRole('link', { name: '웹 백서 읽기' })).toHaveAttribute(
      'href',
      '/whitepaper',
    );
  });

  it('keeps the whitepaper request lifecycle and planned B2B settlement boundary', () => {
    expect(homeKo.lifecycle.map((step) => step.title)).toEqual([
      '요청',
      '계획',
      '선택',
      '승인',
      '실행',
      '검증',
      '복구·사람 인계',
    ]);
    expect(homeKo.settlement).toMatchObject({
      network: 'Base',
      asset: 'Circle Native USDC',
      status: 'planned',
    });
    expect(homeKo.settlement.consumerPayment).toContain('원화');
    expect(homeKo.settlement.consumerPayment).toContain('카드');
  });

  it('opens and closes the mobile menu with button and Escape', () => {
    render(<App />);

    const menuButton = screen.getByRole('button', { name: '메뉴 열기' });
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

  it('renders the retained scenario with the public validation label', () => {
    render(<App />);

    const region = screen.getByRole('region', { name: '실제 활용 시나리오' });
    expect(within(region).getAllByRole('article')).toHaveLength(1);
    expect(within(region).getByText('검증 중')).toBeInTheDocument();
    expect(within(region).queryByText('운영 중')).not.toBeInTheDocument();
  });

  it('renders roadmap states as Korean public labels', () => {
    render(<App />);

    const region = screen.getByRole('region', { name: 'IROA 로드맵' });
    expect(
      within(region)
        .getAllByTestId('roadmap-status')
        .map((status) => status.textContent),
    ).toEqual(['현재', '다음', '계획', '장기 연구']);
  });

  it('does not collect contact data before the official channel exists', () => {
    render(<App />);

    const region = screen.getByRole('region', { name: '기관 도입 문의' });
    expect(within(region).queryByRole('form')).not.toBeInTheDocument();
    expect(within(region).getByText('공식 문의 채널 준비 중')).toBeInTheDocument();
    expect(
      within(region).getByText('공식 문의 채널이 마련되기 전에는 개인정보를 수집하지 않습니다.'),
    ).toBeInTheDocument();
  });
});
