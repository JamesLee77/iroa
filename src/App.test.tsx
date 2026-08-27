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

describe('scenario stories and institution models', () => {
  it('labels all three stories as target experiences, not live services', () => {
    render(<App />);

    const region = screen.getByRole('region', { name: '실제 활용 시나리오' });
    expect(within(region).getAllByRole('article')).toHaveLength(3);
    expect(within(region).getAllByText('목표 경험')).toHaveLength(3);
    expect(within(region).queryByText('운영 중')).not.toBeInTheDocument();
  });

  it('names the three approved institutional adoption models', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: '지자체·복지기관' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '병원·돌봄기관' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '기업·프랜차이즈·CSR' })).toBeInTheDocument();
  });
});

describe('safety and ecosystem boundaries', () => {
  it('renders five safety layers and the public-chain data boundary', () => {
    render(<App />);

    const region = screen.getByRole('region', { name: '안전과 신뢰' });
    expect(within(region).getAllByRole('article')).toHaveLength(5);
    expect(
      within(region).getByText('민감정보는 퍼블릭 블록체인에 기록하지 않습니다.'),
    ).toBeInTheDocument();
  });

  it('connects all five ecosystem layers and marks Robot as long-term', () => {
    render(<App />);

    const region = screen.getByRole('region', { name: 'IROA 생태계' });
    ['사용자 접점', 'IROA Agent', 'Orchestration & Safety Core', '현실 실행 네트워크', '검증 가능한 정산'].forEach(
      (name) => expect(within(region).getByRole('heading', { name })).toBeInTheDocument(),
    );
    expect(within(region).getByText('Robot')).toBeInTheDocument();
    expect(within(region).getByText('장기')).toBeInTheDocument();
  });
});

describe('settlement, roadmap, and contact truth boundaries', () => {
  it('presents Base Native USDC only as B2B settlement after consumer payment', () => {
    render(<App />);

    const region = screen.getByRole('region', { name: '네트워크와 정산' });
    expect(within(region).getByText('Base')).toBeInTheDocument();
    expect(within(region).getByText('Circle Native USDC')).toBeInTheDocument();
    expect(within(region).getByText('원화·카드·계좌')).toBeInTheDocument();
    expect(within(region).getAllByText(/B2B 정산/).length).toBeGreaterThan(0);
    expect(
      within(region).getByText('가스와 지갑은 사용자에게 보이지 않습니다.'),
    ).toBeInTheDocument();
  });

  it('keeps roadmap status in approved order', () => {
    render(<App />);

    const region = screen.getByRole('region', { name: 'IROA 로드맵' });
    expect(
      within(region)
        .getAllByTestId('roadmap-status')
        .map((status) => status.textContent),
    ).toEqual(['현재', '다음', '계획', '장기']);
  });

  it('does not collect contact data before an official channel exists', () => {
    render(<App />);

    const region = screen.getByRole('region', { name: '기관 도입 문의' });
    expect(within(region).queryByRole('form')).not.toBeInTheDocument();
    expect(
      within(region).getByText('공식 문의 채널 연결 전에는 개인정보를 수집하지 않습니다.'),
    ).toBeInTheDocument();
  });
});
