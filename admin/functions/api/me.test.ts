import { describe, expect, it } from 'vitest';
import { onRequestGet } from './me';

describe('Cloudflare Access identity response', () => {
  it('returns the server-mapped persona without exposing email-derived identifiers', async () => {
    const response = await onRequestGet({
      request: new Request('https://admin.iroa.ai/api/me', { headers: {
        'Cf-Access-Authenticated-User-Email': 'person@example.com',
        'Cf-Access-Jwt-Assertion': 'verified-upstream-assertion',
      } }),
      env: { IROA_ADMIN_PERSONAS_JSON: JSON.stringify({ 'person@example.com': 'compliance' }) },
    });
    expect(await response.json()).toEqual({ accessVerified: true, persona: 'compliance' });
  });
});
