import { describe, expect, it } from 'vitest';
import { homeKo } from './home.ko';

const serializedContent = JSON.stringify(homeKo);

describe('approved Korean homepage content', () => {
  it('keeps protocol capabilities explicitly statused', () => {
    expect(homeKo.hero.title).toBe('현실 세계를 위한 검증 가능한 실행 네트워크.');
    expect(homeKo.protocol.planes.map(({ id }) => id)).toEqual([
      'interaction',
      'control',
      'execution',
      'settlement',
    ]);
    expect(homeKo.settlement).toMatchObject({
      network: 'Base',
      asset: 'Circle Native USDC',
      status: 'planned',
    });
    expect(homeKo.economy.rewards.status).toBe('validation');
    expect(homeKo.contact.channelLabel).toBe('공식 문의 채널 준비 중');
  });

  it('excludes speculative and unsupported public claims', () => {
    expect(serializedContent).not.toContain('수익 보장');
    expect(serializedContent).not.toContain('상장 예정');
    expect(serializedContent).not.toContain('운영 중인 Base 정산');
    expect(serializedContent).not.toContain('공식 파트너');
    expect(serializedContent).not.toContain('토큰 구매');
    expect(serializedContent).toContain('Base');
    expect(serializedContent).toContain('Circle Native USDC');
    expect(serializedContent).toContain('개인정보 원문');
    expect(serializedContent).toContain('검증 중');
  });
});
